// ============================================================
// 🐾 PATITAS SOS — POST /api/revisar-coincidencias
//
// Revisión diaria automática (Fase 2): re-cruza los reportes ACTIVOS
// recientes contra los candidatos de rol opuesto que aún no se han
// comparado con Gemini Flash. Así ningún match se pierde aunque haya
// cientos o miles de publicaciones: lo que no se comparó al instante,
// se compara dentro de las siguientes 24 horas.
//
// Programación (Supabase → SQL Editor, ver migración 005):
//   pg_cron + pg_net disparan esta ruta cada día:
//     select cron.schedule('patitas-revision-diaria', '0 7 * * *', $$
//       select net.http_post(url := 'https://TU-APP/api/revisar-coincidencias',
//         headers := '{"content-type":"application/json","x-cron-secret":"TU-SECRETO"}'::jsonb) $$);
//
// Protegida con el header `x-cron-secret` (variable CRON_SECRET).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { CRON_SECRET, GEMINI_DIAS_REVISION, GEMINI_LIMITE_DIARIO, GEMINI_MAX_CANDIDATOS } from '@/lib/constants';
import { buscarCoincidenciasPara, obtenerReportesParaRevision } from '@/lib/matcher';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOTAL_REPORTES_POR_EJECUCION = 40;

export async function POST(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET no está configurado.' }, { status: 503 });
  }
  const recibido = request.headers.get('x-cron-secret');
  if (!recibido || recibido !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const reportes = await obtenerReportesParaRevision(supabase, GEMINI_DIAS_REVISION, TOTAL_REPORTES_POR_EJECUCION);

    const contador = { usadas: 0 };
    let coincidencias = 0;
    let reportesProcesados = 0;

    for (const reporte of reportes) {
      if (contador.usadas >= GEMINI_LIMITE_DIARIO) break;

      const match = await buscarCoincidenciasPara(supabase, reporte.id, {
        saltarComparadas: true,
        contador,
        limiteLlamadas: GEMINI_LIMITE_DIARIO,
      });
      reportesProcesados += 1;
      if (match) {
        coincidencias += 1;
        console.log(
          `[revisión diaria] Match ${match.porcentaje_similitud}% entre ${reporte.id} y ${match.perrito.id} — ${match.razon}`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      reportesDisponibles: reportes.length,
      reportesProcesados,
      llamadasGemini: contador.usadas,
      coincidencias,
      maxCandidatos: GEMINI_MAX_CANDIDATOS,
      limiteDiario: GEMINI_LIMITE_DIARIO,
    });
  } catch (error) {
    console.error('Revisión diaria falló:', error);
    return NextResponse.json({ ok: false, error: 'Error interno en la revisión diaria.' }, { status: 500 });
  }
}