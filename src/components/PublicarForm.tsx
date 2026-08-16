'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { accessTokenHeader, useAuth } from '@/components/AuthProvider';
import { MatchModal } from '@/components/MatchModal';
import { municipiosDe, DEPARTAMENTOS_NOMBRES } from '@/lib/colombia';
import { compressImageToJpeg, formatBytes } from '@/lib/image-utils';
import type { MatchInfo, PublicarResponse, RolPublicacion } from '@/lib/types';

type Tab = RolPublicacion;

const INITIAL_FORM = {
  especie: 'perro',
  nombre: '',
  telefono: '',
  nombreTemporal: '',
  descripcion: '',
  departamento: '',
  ciudad: '',
  barrioZona: '',
};

const inputCls =
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

/**
 * Formulario unificado para Dueños ("PERDIDO") y Rescatistas
 * ("BUSCA_DUEÑO"). Requiere sesión iniciada: si no hay sesión se muestra
 * una invitación a /iniciar-sesion. El email se toma de la sesión (bloqueado);
 * el resto de datos de contacto los llena la persona. Comprime la foto a
 * ≤ 200 KB en el cliente y la envía a /api/publicar-perrito con el token.
 */
export function PublicarForm() {
  const { session, loading, email } = useAuth();

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
        <div className="text-4xl">⏳</div>
        <p className="mt-2 text-sm font-semibold text-neutral-500">Cargando tu sesión…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
        <div className="text-5xl">🔐</div>
        <h2 className="mt-2 text-xl font-black text-neutral-900">Inicia sesión para publicar</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-600">
          Publicar requiere estar identificado (email y contraseña). Así
          guardamos tus publicaciones y te avisamos por web y correo si hay una coincidencia.
        </p>
        <Link
          href="/iniciar-sesion"
          className="mt-5 inline-block rounded-full bg-amber-500 px-8 py-3 text-base font-black text-white shadow-lg transition hover:bg-amber-600"
        >
          🔐 Iniciar sesión
        </Link>
      </div>
    );
  }

  return <FormularioPublicar perfil={{ email: email ?? '', nombre: session.nombre ?? '', telefono: session.telefono ?? '' }} />;
}

function FormularioPublicar({ perfil }: { perfil: { email: string; nombre: string; telefono: string } }) {
  const { session } = useAuth();

  /** Teléfono del perfil (guardado como +573019298995) → dígitos de 10 sin +57. */
  const telefonoDePerfil = () => {
    const digits = perfil.telefono.replace(/\D/g, '');
    if (digits.startsWith('57') && digits.length > 10) return digits.slice(2);
    if (digits.startsWith('0') && digits.length > 10) return digits.slice(1);
    return digits.slice(0, 10);
  };

  const formInicial = { ...INITIAL_FORM, nombre: perfil.nombre, telefono: telefonoDePerfil() };

  const [tab, setTab] = useState<Tab>('PERDIDO');
  const [form, setForm] = useState(formInicial);

  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState('');
  const [fotoInfo, setFotoInfo] = useState('');
  const [compressing, setCompressing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [success, setSuccess] = useState(false);
  const [perritoId, setPerritoId] = useState('');

  // Comprime la foto elegida a ≤ 200 KB antes de enviarla
  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setError('');
    setCompressing(true);
    try {
      const compressed = await compressImageToJpeg(file);
      setFoto(compressed);
      setFotoPreview(URL.createObjectURL(compressed));
      setFotoInfo(`Foto lista: ${formatBytes(compressed.size)} (máximo 200 KB)`);
    } catch {
      setError('No pudimos procesar la foto. Intenta con otra imagen.');
      setFoto(null);
      setFotoPreview('');
      setFotoInfo('');
    } finally {
      setCompressing(false);
    }
  }, []);

  const setField =
    (key: keyof typeof INITIAL_FORM) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  /** Teléfono: solo dígitos, máximo 10 (el +57 va fijo). */
  const setTelefono = (event: ChangeEvent<HTMLInputElement>) => {
    let digits = event.target.value.replace(/\D/g, '');
    // Si pegaron el número con indicativo (+57…) o con cero inicial, normalizar
    if (digits.startsWith('57') && digits.length > 10) digits = digits.slice(2);
    else if (digits.startsWith('0') && digits.length > 10) digits = digits.slice(1);
    setForm((prev) => ({ ...prev, telefono: digits.slice(0, 10) }));
  };

  const setDepartamento = (event: ChangeEvent<HTMLSelectElement>) => {
    const departamento = event.target.value;
    setForm((prev) => ({ ...prev, departamento, ciudad: '' }));
  };

  const resetForm = () => {
    setForm(formInicial);
    setFoto(null);
    setFotoPreview('');
    setFotoInfo('');
    setSuccess(false);
    setError('');
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!foto) {
      setError('Sube o toma una foto clara de la mascota.');
      return;
    }
    if (submitting || compressing) return;

    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('rol', tab);
      formData.append('especie', form.especie);
      formData.append('nombre', form.nombre);
      formData.append('telefono', `+57${form.telefono}`);
      formData.append('nombre_temporal', form.nombreTemporal);
      formData.append('descripcion', form.descripcion);
      formData.append('departamento', form.departamento);
      formData.append('ciudad', form.ciudad);
      formData.append('barrio_zona', form.barrioZona);
      formData.append('foto', foto);

      const res = await fetch('/api/publicar-perrito', {
        method: 'POST',
        headers: accessTokenHeader(session),
        body: formData,
      });
      const data: PublicarResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Ocurrió un error al publicar. Intenta de nuevo.');
      }

      setPerritoId(data.perritoId ?? '');

      if (data.match && data.matchInfo) {
        // 🎉 La IA encontró una coincidencia → congelar pantalla con el modal
        setMatchInfo(data.matchInfo);
      } else {
        setSuccess(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  const tabActive =
    (t: Tab) =>
    t === tab
      ? t === 'PERDIDO'
        ? 'bg-rose-600 text-white shadow'
        : 'bg-emerald-600 text-white shadow'
      : 'text-neutral-500 hover:bg-neutral-100';

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        {/* ---- Pestañas Dueño / Rescatista ---- */}
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-neutral-200 bg-white p-1.5">
          <button
            type="button"
            onClick={() => setTab('PERDIDO')}
            className={`rounded-xl px-2 py-3 text-sm font-bold transition ${tabActive('PERDIDO')}`}
          >
            😢 Perdí a mi mascota
          </button>
          <button
            type="button"
            onClick={() => setTab('BUSCA_DUEÑO')}
            className={`rounded-xl px-2 py-3 text-sm font-bold transition ${tabActive('BUSCA_DUEÑO')}`}
          >
            🏠 Encontré una mascota
          </button>
        </div>

        {/* ---- Foto ---- */}
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-5 text-center">
          {fotoPreview ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotoPreview}
                alt="Vista previa de la foto"
                className="mx-auto h-48 w-48 rounded-2xl object-cover shadow-md"
              />
              <p className="mt-2 text-xs font-semibold text-emerald-600">{fotoInfo}</p>
              <button
                type="button"
                onClick={() => {
                  setFoto(null);
                  setFotoPreview('');
                  setFotoInfo('');
                }}
                className="mt-2 text-xs font-semibold text-rose-600 underline"
              >
                Quitar foto
              </button>
            </div>
          ) : (
            <div>
              <div className="text-5xl">📸</div>
              <p className="mt-2 text-sm font-bold text-neutral-800">Foto de la mascota</p>
              <p className="mt-1 text-xs text-neutral-500">
                De frente y con buena luz para que la IA encuentre coincidencias. En perros y gatos también funciona.
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <label className="cursor-pointer rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700">
                  📷 Tomar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="cursor-pointer rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100">
                  🖼️ Subir foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {compressing && (
                <p className="mt-3 text-xs font-medium text-amber-600">Optimizando la foto… ⏳</p>
              )}
            </div>
          )}
        </div>

        {/* ---- Datos de contacto ---- */}
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 className="text-sm font-black uppercase tracking-wide text-neutral-500">
            Datos de contacto
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tu nombre *">
              <input
                value={form.nombre}
                onChange={setField('nombre')}
                placeholder="Ej: María González"
                className={inputCls}
                required
              />
            </Field>
            <Field label="Teléfono móvil (WhatsApp) *">
              <div className="flex items-center overflow-hidden rounded-xl border border-neutral-300 bg-white transition focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200">
                <span className="border-r border-neutral-200 bg-neutral-100 px-3.5 py-2.5 text-sm font-bold text-neutral-700">
                  +57
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.telefono}
                  onChange={setTelefono}
                  placeholder="300 123 4567"
                  maxLength={10}
                  pattern="3\d{9}"
                  className="w-full bg-transparent px-3.5 py-2.5 text-sm outline-none"
                  required
                />
              </div>
            </Field>
          </div>
          <Field label="Email (de tu sesión)">
            <div className="flex items-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
              <span className="w-full truncate px-3.5 py-2.5 text-sm font-semibold text-neutral-600">
                {perfil.email}
              </span>
              <Link
                href="/iniciar-sesion"
                className="shrink-0 border-l border-neutral-200 px-3 py-2.5 text-xs font-bold text-amber-600 underline hover:bg-white"
              >
                Cambiar
              </Link>
            </div>
          </Field>
        </div>

        {/* ---- Datos del perrito ---- */}
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 className="text-sm font-black uppercase tracking-wide text-neutral-500">
            Datos de la mascota
          </h3>
          <Field label="Tipo de mascota *">
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-neutral-300 bg-white p-1.5">
              {(['perro', 'gato'] as const).map((esp) => (
                <button
                  key={esp}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, especie: esp }))}
                  className={`rounded-lg px-2 py-2 text-sm font-bold transition ${
                    form.especie === esp
                      ? 'bg-amber-500 text-white shadow'
                      : 'text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {esp === 'perro' ? '🐶 Perro' : '🐱 Gato'}
                </button>
              ))}
            </div>
          </Field>
          <Field label={tab === 'PERDIDO' ? 'Nombre de tu mascota (si lo sabes)' : 'Nombre temporal (opcional)'}>
            <input
              value={form.nombreTemporal}
              onChange={setField('nombreTemporal')}
              placeholder={tab === 'PERDIDO' ? 'Ej: Toby' : 'Ej: "Cafecito" (como le llamamos)'}
              className={inputCls}
            />
          </Field>
          <Field label="Descripción *">
            <textarea
              value={form.descripcion}
              onChange={setField('descripcion')}
              rows={3}
              placeholder="Raza, tamaño, color, señas particulares, collar…"
              className={inputCls}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Departamento *">
              <select
                value={form.departamento}
                onChange={setDepartamento}
                className={inputCls}
                required
              >
                <option value="">Selecciona el departamento…</option>
                {DEPARTAMENTOS_NOMBRES.map((departamento) => (
                  <option key={departamento} value={departamento}>
                    {departamento}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ciudad / Municipio *">
              <select
                value={form.ciudad}
                onChange={setField('ciudad')}
                className={inputCls}
                disabled={!form.departamento}
                required
              >
                <option value="">
                  {form.departamento ? 'Selecciona el municipio…' : 'Primero elige el departamento'}
                </option>
                {municipiosDe(form.departamento).map((municipio) => (
                  <option key={municipio} value={municipio}>
                    {municipio}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Dirección / Barrio">
            <input
              value={form.barrioZona}
              onChange={setField('barrioZona')}
              placeholder="Ej: Cra 7 # 45-12, Barrio Chapinero"
              className={inputCls}
            />
          </Field>
        </div>

        {/* ---- Errores ---- */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            ⚠️ {error}
          </div>
        )}

        {/* ---- Enviar ---- */}
        <button
          type="submit"
          disabled={submitting || compressing}
          className="w-full rounded-full bg-amber-500 py-4 text-lg font-black text-white shadow-lg transition hover:bg-amber-600 disabled:opacity-60"
        >
          {submitting
            ? 'Analizando con IA… 🧠'
            : tab === 'PERDIDO'
              ? 'Publicar mi reporte de búsqueda'
              : 'Publicar reporte del rescatado'}
        </button>

        <p className="text-center text-xs text-neutral-400">
          🔒 Tus datos solo se comparten si la IA encuentra una coincidencia con otra publicación.
        </p>
      </form>

      {/* ---- Éxito sin match ---- */}
      {success && !matchInfo && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="text-5xl">✅</div>
          <h3 className="mt-2 text-xl font-black text-emerald-800">¡Reporte publicado!</h3>
          <p className="mt-1 text-sm text-emerald-700">
            Ya está visible en el feed. La IA no encontró coincidencias por ahora; si aparece una
            nueva publicación con una mascota parecida, te escribiremos a tu correo.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Ver el feed
            </Link>
            <Link
              href="/mis-publicaciones"
              className="rounded-full border border-emerald-600 px-6 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
            >
              📋 Mis publicaciones
            </Link>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-emerald-600 px-6 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
            >
              Publicar otro
            </button>
          </div>
        </div>
      )}

      {/* ---- 🎉 Modal de coincidencia (congela la pantalla) ---- */}
      {matchInfo && (
        <MatchModal
          matchInfo={matchInfo}
          onClose={() => {
            setMatchInfo(null);
            setSuccess(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
