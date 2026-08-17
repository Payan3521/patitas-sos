#!/usr/bin/env node
// ============================================================
// 🐾 PATITAS SOS — Smoke de certificación del modo instantáneo
//
// Verifica el flujo completo "match de una" por HTTP real:
//   1. Siembra N candidatos BUSCA_DUEÑO (perros) en Armenia/Quindío
//      con fotos reales, más 2 gatos para probar el filtro de especie.
//      El par que debe hacer match queda al FINAL del ranking
//      (creado_en más antiguo: el matcher ordena por cercanía y
//      después por más recientes).
//   2. Publica un PERDIDO (usuario distinto) con la MISMA foto del
//      candidato final → mide el tiempo de respuesta (< 6 s).
//   3. Hace polling a GET /api/matches-para hasta que el match
//      aparezca (flujo de background de la publicación).
//   4. Verifica: match == candidato objetivo con similitud ≥ 80 %,
//      escaneo COMPLETO (comparaciones == N), filtro de especie
//      (0 comparaciones contra gatos).
//   5. Limpieza automática de TODO lo que creó.
//
// Uso:  node scripts/smoke-comparar-todos.mjs [--candidatos=20]
//       (requiere la app corriendo: npm run build && npm start,
//        y el .env.local con Supabase + GEMINI_API_KEY renovada)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ARCHIVO_ENV = path.join(process.cwd(), '.env.local');
const BUCKET = 'fotos-perritos';
const CARPETA_FOTOS = path.join(process.cwd(), 'scripts', 'fotos-test');
const CANDIDATOS = Number.parseInt(process.argv.find((a) => a.startsWith('--candidatos='))?.split('=')[1] ?? '20', 10);
const GATOS = 2;
const POLL_MAX_MS = 180_000;
const POLL_INTERVALO_MS = 3_000;
const TIEMPO_PUBLICACION_MAX_MS = 6_000;

// Fotos de perros (Unsplash directo; el script baja solo las primeras que
// respondan y cae a picsum si alguna falla).
const FOTOS_UNSPLASH = [
  'photo-1552053831-71594a27632d',
  'photo-1543466835-00a7907e9de1',
  'photo-1583337130417-3346a1be7dee',
  'photo-1517849845537-4d257902454a',
  'photo-1548199973-03cce0bbc87b',
  'photo-1587300003388-59208cc962cb',
  'photo-1568572933382-74d440642117',
  'photo-1450778869180-41d0601e046e',
  'photo-1585110396000-c9ffd4e4b308',
  'photo-1544568100-847a948585b9',
  'photo-1537151625747-768eb6cf92b2',
  'photo-1560807707-8cc77767d783',
  'photo-1558788353-f76d92427f16',
  'photo-1591160690555-5debfba289f0',
  'photo-1601758228041-f3b2795255f1',
  'photo-1541364983171-a8ba01e95cfc',
  'photo-1561037404-61cd46aa615b',
  'photo-1518717758536-85ae29035b6d',
  'photo-1507146426996-ef05306b995a',
  'photo-1583512603805-3cc6b41f3edb',
  'photo-1530281700549-e82e7bf110d6',
  'photo-1605568427561-40dd23c2acea',
  'photo-1605902711622-cfb43c4437b5',
  'photo-1494783367193-149034c05e8f',
  'photo-1517130038641-a774d04afb3c',
].map((id) => `https://images.unsplash.com/${id}?w=640&q=70&fm=jpg`);

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
const ahora = () => new Date().toISOString().slice(11, 19);
const log = (msg, ok = null) => {
  const marca = ok === true ? '✅' : ok === false ? '❌' : '──';
  console.log(`[${ahora()}] ${marca} ${msg}`);
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function leerEnvLocal() {
  if (!fs.existsSync(ARCHIVO_ENV)) {
    console.error('❌ No existe .env.local en', process.cwd());
    process.exit(1);
  }
  const vars = {};
  for (const linea of fs.readFileSync(ARCHIVO_ENV, 'utf8').split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const eq = limpia.indexOf('=');
    if (eq <= 0) continue;
    vars[limpia.slice(0, eq).trim()] = limpia
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return vars;
}

const ENV = leerEnvLocal();
const URL_BASE = ENV.NEXT_PUBLIC_SUPABASE_URL;
const LLAVE = ENV.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = (ENV.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Llamada a Supabase (REST) con la service role key. */
async function rest(ruta, metodos = 'GET', cuerpo) {
  const opciones = { method: metodos, headers: { apikey: LLAVE, Authorization: `Bearer ${LLAVE}` } };
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  }
  const res = await fetch(`${URL_BASE}${ruta}`, opciones);
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  return { ok: res.ok, status: res.status, datos };
}

/** Llamada a la app (Next.js) con cookie opcional. */
async function app(ruta, opciones = {}) {
  const res = await fetch(`${APP_URL}${ruta}`, {
    ...opciones,
    headers: { ...(opciones.headers ?? {}), ...(opciones.cookie ? { Cookie: opciones.cookie } : {}) },
  });
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  return { ok: res.ok, status: res.status, datos, setCookie: res.headers.get('set-cookie') ?? '' };
}

function cookieDe(res) {
  const nombre = res.setCookie.split('=')[0];
  const valor = res.setCookie.split(';')[0];
  return `${nombre}=${valor.split('=').slice(1).join('=')}`;
}

// ------------------------------------------------------------
// 0. Pre-checks
// ------------------------------------------------------------
log(`Smoke "comparar todos" — ${CANDIDATOS} candidatos + ${GATOS} gatos`);
if (!URL_BASE || !LLAVE) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.');
  process.exit(1);
}
if (!ENV.GEMINI_API_KEY) {
  console.error('❌ Falta GEMINI_API_KEY en .env.local (la cuota free se renueva a las 2:00 a. m.).');
  process.exit(1);
}

// ------------------------------------------------------------
// 1. Fotos de prueba (descargar + comprimir ≤ 200 KB)
// ------------------------------------------------------------
log(`Fotos de prueba → ${CARPETA_FOTOS}`);
fs.mkdirSync(CARPETA_FOTOS, { recursive: true });
const FOTOS = [];
const TOTAL_FOTOS = CANDIDATOS + 1; // 1 foto distinta por candidato + 1 compartida (par)

async function descargarFoto(url, destino, intento = 0) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (smoke patitas-sos)' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 4096) throw new Error('imagen demasiado pequeña');
    return buf;
  } catch (error) {
    if (intento < 2) {
      await esperar(1_500);
      return descargarFoto(url, destino, intento + 1);
    }
    throw error;
  }
}

async function asegurarFotos() {
  const necesarios = Math.max(0, TOTAL_FOTOS - FOTOS.length);
  if (necesarios === 0) return;
  for (let i = FOTOS.length; i < TOTAL_FOTOS; i++) {
    const nombre = `dog-${String(i).padStart(2, '0')}.jpg`;
    const ruta = path.join(CARPETA_FOTOS, nombre);
    let buf = null;
    if (fs.existsSync(ruta)) {
      buf = fs.readFileSync(ruta);
    } else {
      const fuente = FOTOS_UNSPLASH[i] ?? `https://picsum.photos/seed/smoke-dog-${i}/640/640`;
      try {
        buf = await descargarFoto(fuente, ruta);
        // Comprimir/redimensionar a ≤ 200 KB (imagen cuadrada 640×640)
        fs.writeFileSync(ruta, buf);
        execFileSync('convert', [ruta, '-resize', '640x640^', '-gravity', 'center', '-extent', '640x640', '-strip', '-quality', '72', ruta]);
        buf = fs.readFileSync(ruta);
        if (buf.byteLength > 200 * 1024) {
          execFileSync('convert', [ruta, '-quality', '55', ruta]);
          buf = fs.readFileSync(ruta);
        }
        if (buf.byteLength < 1024) throw new Error('imagen comprimida demasiado pequeña');
        log(`foto ${nombre} (${Math.round(buf.byteLength / 1024)} KB)`);
      } catch (error) {
        console.warn(`  ⚠️ ${nombre}: ${error.message} → picsum`);
        buf = await descargarFoto(`https://picsum.photos/seed/smoke-dog-${i}/640/640`, ruta);
        fs.writeFileSync(ruta, buf);
        try {
          execFileSync('convert', [ruta, '-resize', '640x640^', '-gravity', 'center', '-extent', '640x640', '-strip', '-quality', '72', ruta]);
          buf = fs.readFileSync(ruta);
        } catch {}
      }
    }
    if (!buf || buf.byteLength < 1024) throw new Error(`No se pudo preparar ${nombre}`);
    FOTOS.push({ nombre, bytes: buf });
    if (buf.byteLength > 200 * 1024) throw new Error(`${nombre} sigue > 200 KB (${buf.byteLength})`);
  }
}
await asegurarFotos();
const FOTO_PAR = FOTOS[0]; // la misma para el PERDIDO y el candidato objetivo

// ------------------------------------------------------------
// 2. Usuarios de prueba (flujo real por la API de la app)
// ------------------------------------------------------------
const sufijo = Date.now();
const EMAIL_CAND = `smoke.candidatos.${sufijo}@test.sospets.co`;
const EMAIL_DUENO = `smoke.dueno.${sufijo}@test.sospets.co`;
const CONTRASENA = 'smoke-123456';
let idCand, idDueno, cookieDueno;

async function registrarUsuario(email) {
  const res = await app('/api/registro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Smoke Test', telefono: '3001234567', email, password: CONTRASENA }),
  });
  if (!res.ok) throw new Error(`Registro ${email} falló (HTTP ${res.status}): ${JSON.stringify(res.datos)}`);
  const q = `/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id`;
  const r = await rest(q);
  if (!Array.isArray(r.datos) || !r.datos[0]?.id) {
    console.error(`  [debug] registro ok. rest ${q} → HTTP ${r.status}: ${JSON.stringify(r.datos)}`);
    throw new Error(`No se encontró el usuario ${email}`);
  }
  return { id: r.datos[0].id, cookie: cookieDe(res) };
}

log('Usuarios de prueba (registro + sesión por la API)');
const cand = await registrarUsuario(EMAIL_CAND);
idCand = cand.id;
const dueno = await registrarUsuario(EMAIL_DUENO);
idDueno = dueno.id;
cookieDueno = dueno.cookie;

// ------------------------------------------------------------
// 3. Semillas: candidatos BUSCA_DUEÑO (perros) + gatos
// ------------------------------------------------------------
log(`Sembrando ${CANDIDATOS} candidatos (perros) + ${GATOS} gatos en Armenia/Quindío`);
const ahoraMs = Date.now();
const creados = []; // { id, fotoPath, esObjetivo, especie }

async function subirFoto(id, bytes) {
  const ruta = `perritos/${id}.jpg`;
  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'PUT',
    headers: {
      apikey: LLAVE,
      Authorization: `Bearer ${LLAVE}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Subir foto falló (HTTP ${res.status})`);
  return `${URL_BASE}/storage/v1/object/public/${BUCKET}/${ruta}`;
}

async function insertarCandidato({ especie, fotoBytes, creadoEn, esObjetivo = false, nombre }) {
  const id = crypto.randomUUID();
  const fotoUrl = await subirFoto(id, fotoBytes);
  const fila = {
    id,
    usuario_id: idCand,
    rol_publicacion: 'BUSCA_DUEÑO',
    especie,
    nombre_temporal: nombre ?? (esObjetivo ? 'Smoky (objetivo)' : `Candidato ${creados.length + 1}`),
    descripcion: `Mascota encontrada de la prueba de certificación (${especie}). Reporte de humo automatizado.`,
    departamento: 'Quindío',
    ciudad: 'Armenia',
    barrio_zona: null,
    foto_url: fotoUrl,
    estado: 'ACTIVO',
    creado_en: creadoEn,
  };
  const res = await rest('/rest/v1/perritos', 'POST', fila);
  if (!res.ok) throw new Error(`Insertar candidato falló (HTTP ${res.status}): ${JSON.stringify(res.datos)}`);
  creados.push({ id, fotoPath: `perritos/${id}.jpg`, esObjetivo, especie });
  return id;
}

for (let i = 0; i < CANDIDATOS - 1; i++) {
  await insertarCandidato({
    especie: 'perro',
    fotoBytes: FOTOS[i + 1].bytes,
    creadoEn: new Date(ahoraMs - (3 + i) * 60_000).toISOString(),
    nombre: `Candidato ${i + 1}`,
  });
}
const objetivoId = await insertarCandidato({
  especie: 'perro',
  fotoBytes: FOTO_PAR.bytes,
  creadoEn: new Date(ahoraMs - 2 * 3_600_000).toISOString(),
  esObjetivo: true,
});
for (let i = 0; i < GATOS; i++) {
  await insertarCandidato({
    especie: 'gato',
    fotoBytes: FOTOS[i % FOTOS.length].bytes,
    creadoEn: new Date(ahoraMs - 10_000 - i * 60_000).toISOString(),
    nombre: `Gato ${i + 1}`,
  });
}
log(`Sembrados ${creados.length} reportes (objetivo al final del ranking)`, true);

// ------------------------------------------------------------
// 4. Publicar el PERDIDO (flujo real por HTTP, con foto del par)
// ------------------------------------------------------------
const fd = new FormData();
fd.append('rol', 'PERDIDO');
fd.append('especie', 'perro');
fd.append('nombre', 'Smoke Test');
fd.append('telefono', '3001234567');
fd.append('email', EMAIL_DUENO);
fd.append('departamento', 'Quindío');
fd.append('ciudad', 'Armenia');
fd.append('nombre_temporal', 'Smoky');
fd.append('descripcion', 'Perro de prueba del smoke de certificación del modo instantáneo. Foto idéntica al candidato objetivo.');
fd.append('barrio_zona', 'Barrio de prueba');
fd.append('foto', new Blob([FOTO_PAR.bytes], { type: 'image/jpeg' }), 'smoky.jpg');

log('Publicando PERDIDO (POST /api/publicar-perrito)…');
const t0 = performance.now();
const pub = await app('/api/publicar-perrito', { method: 'POST', body: fd, cookie: cookieDueno });
const tiempoPublicacion = performance.now() - t0;
const perritoId = pub.datos?.perritoId ?? '';
log(`Respuesta en ${(tiempoPublicacion / 1000).toFixed(2)} s`, tiempoPublicacion < TIEMPO_PUBLICACION_MAX_MS);
if (!pub.ok) {
  log(`Publicar falló (HTTP ${pub.status}): ${JSON.stringify(pub.datos)}`, false);
  process.exitCode = 1;
} else {
  creados.push({ id: perritoId, fotoPath: `perritos/${perritoId}.jpg`, esObjetivo: false, especie: 'perro' });
}

// ------------------------------------------------------------
// 5. Polling del match (flujo de background)
// ------------------------------------------------------------
let matchInfo = pub.datos?.match ? pub.datos.matchInfo : null;
let matchId = matchInfo?.matchId ?? null;
let esperaMs = 0;
while (!matchInfo && esperaMs < POLL_MAX_MS && process.exitCode !== 1) {
  await esperar(POLL_INTERVALO_MS);
  esperaMs += POLL_INTERVALO_MS;
  const poll = await app(`/api/matches-para?perrito_id=${perritoId}`, { cookie: cookieDueno });
  if (poll.ok && poll.datos?.match) {
    matchInfo = poll.datos.matchInfo;
    matchId = matchInfo.matchId;
    log(`Match detectado por polling a los ${(esperaMs / 1000).toFixed(0)} s`, true);
  } else if (!poll.ok) {
    log(`Polling falló (HTTP ${poll.status}): ${JSON.stringify(poll.datos)}`, false);
    process.exitCode = 1;
    break;
  }
}
if (!matchInfo && process.exitCode !== 1) {
  log(`No apareció match en ${POLL_MAX_MS / 1000} s de polling`, false);
  process.exitCode = 1;
}

// ------------------------------------------------------------
// 6. Verificaciones
// ------------------------------------------------------------
let comparacionesObj = 0;
let comparacionesGatos = 0;
if (matchInfo && !process.exitCode) {
  log('── Verificaciones ──');
  // 6.1 El match es el candidato objetivo (el del final del ranking)
  const esObjetivo = matchInfo.perrito?.id === objetivoId;
  log(`Match es el candidato objetivo (#${CANDIDATOS}): ${esObjetivo ? 'sí' : 'NO — ' + matchInfo.perrito?.id}`, esObjetivo);
  if (!esObjetivo) {
    log(`Similitud real: ${matchInfo.porcentaje_similitud}% contra ${matchInfo.perrito?.id}`, false);
    process.exitCode = 1;
  }
  // 6.2 Similitud ≥ umbral (80 %)
  const sim = Number(matchInfo.porcentaje_similitud ?? 0);
  log(`Similitud ${sim}% (umbral 80%)`, sim >= 80);

  // 6.3 Escaneo completo: comparaciones del PERDIDO >= candidatos sembrados
  //     (puede haber algún candidato previo de otras pruebas en la BD:
  //     el escaneo compara TODO el rol opuesto de la misma especie).
  const comp = await rest(
    `/rest/v1/comparaciones?or=(perrito_a_id.eq.${perritoId},perrito_b_id.eq.${perritoId})&select=id`,
  );
  comparacionesObj = Array.isArray(comp.datos) ? comp.datos.length : -1;
  const extras = comparacionesObj > CANDIDATOS ? ` (+${comparacionesObj - CANDIDATOS} previos de la BD)` : '';
  log(`Escaneo completo: ${comparacionesObj} comparaciones ${extras} (mínimo esperado: ${CANDIDATOS})`, comparacionesObj >= CANDIDATOS);

  // 6.4 Filtro de especie: los gatos NO se compararon
  const idsGatos = creados.filter((c) => c.especie === 'gato').map((c) => c.id).join(',');
  const compGatos = await rest(
    `/rest/v1/comparaciones?or=(perrito_a_id.in.(${idsGatos}),perrito_b_id.in.(${idsGatos}))&select=id`,
  );
  comparacionesGatos = Array.isArray(compGatos.datos) ? compGatos.datos.length : -1;
  log(`Filtro de especie: ${comparacionesGatos} comparaciones contra gatos (esperado 0)`, comparacionesGatos === 0);

  if (comparacionesObj < CANDIDATOS || comparacionesGatos !== 0 || sim < 80) process.exitCode = 1;
} else if (process.exitCode !== 1) {
  process.exitCode = 1;
}

// ------------------------------------------------------------
// 7. Resumen
// ------------------------------------------------------------
console.log('');
console.log('── Resumen ──');
console.log(`  Publicación: ${(tiempoPublicacion / 1000).toFixed(2)} s (máx ${TIEMPO_PUBLICACION_MAX_MS / 1000} s)`);
if (matchInfo) console.log(`  Match: ${matchInfo.perrito?.id === objetivoId ? 'OBJETIVO' : 'otro'} · ${matchInfo.porcentaje_similitud}% · espera ${(esperaMs / 1000).toFixed(0)} s`);
console.log(`  Comparaciones: ${comparacionesObj}/${CANDIDATOS} · contra gatos: ${comparacionesGatos}`);
console.log(process.exitCode ? '\n❌ SMOKE FALLÓ' : '\n✨ SMOKE EN VERDE — modo instantáneo certificado');

// ------------------------------------------------------------
// 8. Limpieza (SIEMPRE, incluso con errores)
// ------------------------------------------------------------
console.log('\n── Limpieza ──');
const todosIds = creados.map((c) => c.id).join(',');
const usuariosIds = [idCand, idDueno].join(',');
const enc = (v) => encodeURIComponent(v);

async function borrar(ruta) {
  const res = await rest(ruta, 'DELETE');
  log(`${ruta.slice(0, 90)} → ${res.status}`, res.ok);
  return res.ok;
}

if (todosIds) {
  await borrar(`/rest/v1/comparaciones?or=(${enc(`perrito_a_id.in.(${todosIds}),perrito_b_id.in.(${todosIds})`)})`);
  await borrar(`/rest/v1/matches_ia?or=(${enc(`perrito_perdido_id.in.(${todosIds}),perrito_encontrado_id.in.(${todosIds})`)})`);
  await borrar(`/rest/v1/notificaciones?or=(${enc(`perrito_id.in.(${todosIds}),mi_perrito_id.in.(${todosIds})`)})`);
  await borrar(`/rest/v1/perritos?id=in.(${todosIds})`);
  for (const c of creados) {
    await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${c.fotoPath}`, {
      method: 'DELETE',
      headers: { apikey: LLAVE, Authorization: `Bearer ${LLAVE}` },
    }).catch(() => {});
  }
}
await borrar(`/rest/v1/usuarios?id=in.(${usuariosIds})`);

const { data: sobrantes } = await rest(`/rest/v1/perritos?usuario_id=in.(${usuariosIds})&select=id`);
log(`Registros sobrantes de los usuarios de prueba: ${sobrantes?.length ?? 0}`, (sobrantes?.length ?? 0) === 0);

process.exit(process.exitCode ?? 0);
