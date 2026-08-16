#!/usr/bin/env node
// ============================================================
// 🐾 PATITAS SOS — Limpieza total (base + fotos)
//
// Borra TODO el contenido de la app para probar desde ceros:
//   - Filas de las tablas: comparaciones, matches_ia,
//     notificaciones, perritos y usuarios (en ese orden por
//     dependencias entre tablas).
//   - Todos los archivos del bucket público `fotos-perritos`.
//
// Usa la SUPABASE_SERVICE_ROLE_KEY del .env.local (solo
// lectura local de variables; no imprime ningún secreto).
//
// Uso:  npm run limpiar
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

const ARCHIVO_ENV = path.join(process.cwd(), '.env.local');
const BUCKET = 'fotos-perritos';
const UUID_MUERTO = '00000000-0000-0000-0000-000000000000';
const TABLAS = ['comparaciones', 'matches_ia', 'notificaciones', 'perritos', 'usuarios'];

// ------------------------------------------------------------
// Lectura del .env.local (parser minimalista, sin dependencias)
// ------------------------------------------------------------
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

const { NEXT_PUBLIC_SUPABASE_URL: URL_BASE, SUPABASE_SERVICE_ROLE_KEY: LLAVE } = leerEnvLocal();
if (!URL_BASE || !LLAVE) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.');
  process.exit(1);
}

const CABECERAS = { apikey: LLAVE, Authorization: `Bearer ${LLAVE}` };

async function api(ruta, metodos = 'GET', cuerpo) {
  const opciones = { method: metodos, headers: { ...CABECERAS } };
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }
  return fetch(`${URL_BASE}${ruta}`, opciones);
}

// ------------------------------------------------------------
// Base de datos: contar y borrar filas por tabla
// ------------------------------------------------------------
async function contarFilas(tabla) {
  try {
    const res = await api(`/rest/v1/${tabla}?select=id&limit=1000`);
    if (!res.ok) return -1;
    const filas = await res.json();
    return Array.isArray(filas) ? filas.length : -1;
  } catch {
    return -1;
  }
}

async function borrarTabla(tabla) {
  const antes = await contarFilas(tabla);
  let status = '—';
  try {
    const res = await api(`/rest/v1/${tabla}?id=neq.${UUID_MUERTO}`, 'DELETE');
    status = res.status;
  } catch {
    status = 'error de red';
  }
  const despues = await contarFilas(tabla);
  const ok = despues === 0;
  console.log(
    `  ${ok ? '✅' : '❌'} ${tabla.padEnd(14)} ${antes < 0 ? '(no leíble)' : `${antes} filas`} → ${despues < 0 ? '(no leíble)' : `${despues} filas`}  (DELETE ${status})`,
  );
  return ok;
}

// ------------------------------------------------------------
// Storage: vaciar el bucket (listado recursivo + borrado)
// ------------------------------------------------------------
async function listarPrefijo(prefijo) {
  const res = await api(`/storage/v1/object/list/${BUCKET}`, 'POST', {
    prefix: prefijo,
    limit: 100,
    offset: 0,
  });
  if (!res.ok) throw new Error(`No se pudo listar el bucket (HTTP ${res.status}).`);
  return res.json();
}

/** Recorre carpetas y devuelve las rutas completas de todos los archivos. */
async function colectarArchivos() {
  const archivos = [];
  const cola = [''];
  while (cola.length) {
    const prefijo = cola.shift();
    const items = await listarPrefijo(prefijo);
    for (const item of items) {
      const esCarpeta = item.id?.endsWith('/') ?? item.name.endsWith('/');
      if (esCarpeta) {
        cola.push(`${prefijo}${item.name}/`);
      } else {
        archivos.push(`${prefijo}${item.name}`);
      }
    }
  }
  return archivos;
}

async function vaciarBucket() {
  let archivos;
  try {
    archivos = await colectarArchivos();
  } catch (error) {
    console.error(`  ❌ buckete ${BUCKET}: ${error.message}`);
    return false;
  }
  if (archivos.length === 0) {
    console.log('  ✅ Bucket fotos-perritos ya estaba vacío.');
    return true;
  }
  let ok = true;
  for (const ruta of archivos) {
    try {
      const res = await api(`/storage/v1/object/${BUCKET}/${ruta}`, 'DELETE');
      console.log(`  ${res.ok ? '✅' : '❌'} borrada foto: ${ruta}  (HTTP ${res.status})`);
      ok = ok && res.ok;
    } catch {
      console.log(`  ❌ borrada foto: ${ruta}  (error de red)`);
      ok = false;
    }
  }
  return ok;
}

// ------------------------------------------------------------
// Verificación final
// ------------------------------------------------------------
async function verificacionFinal() {
  console.log('\n── Verificación final ──');
  let todoOk = true;
  for (const tabla of TABLAS) {
    const filas = await contarFilas(tabla);
    if (filas === 0) console.log(`  ✅ ${tabla}: 0 filas`);
    else {
      console.log(`  ❌ ${tabla}: ${filas < 0 ? '(no leíble)' : `${filas} filas`}`);
      todoOk = false;
    }
  }
  const restantes = await colectarArchivos().catch(() => []);
  if (restantes.length === 0) console.log('  ✅ Bucket fotos-perritos: vacío');
  else {
    console.log(`  ❌ Quedan ${restantes.length} archivos en el bucket`);
    todoOk = false;
  }
  return todoOk;
}

// ------------------------------------------------------------
// Ejecución
// ------------------------------------------------------------
console.log('🧹 PATITAS SOS — Limpieza total\n');
console.log('── Vaciar tablas ──');
let ok = true;
for (const tabla of TABLAS) {
  ok = (await borrarTabla(tabla)) && ok;
}

console.log('\n── Vaciar bucket fotos-perritos ──');
ok = (await vaciarBucket()) && ok;

const finalOk = await verificacionFinal();
ok = ok && finalOk;

console.log(ok ? '\n✨ Todo limpio. Listo para probar desde cero.' : '\n⚠️ Hubo errores: revisa los mensajes de arriba.');
process.exit(ok ? 0 : 1);