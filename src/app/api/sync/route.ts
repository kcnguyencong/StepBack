import { NextRequest, NextResponse } from 'next/server';
import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from '@/lib/neonClient';
import { RecoveryCase } from '@/data/axvyraDomain';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    return NextResponse.json({ connected: false, message: 'DATABASE_URL not configured' });
  }

  await ensureNeonTables();

  const userId = req.nextUrl.searchParams.get('userId');
  if (userId) {
    const userCase = await executeNeonQuery(
      `SELECT data FROM recovery_cases WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );
    if (userCase.rows.length > 0) {
      return NextResponse.json({ connected: true, data: userCase.rows[0].data });
    }
  }

  const caseId = req.nextUrl.searchParams.get('id');
  if (caseId) {
    const result = await executeNeonQuery(
      `SELECT data FROM recovery_cases WHERE id = $1 LIMIT 1`,
      [caseId]
    );
    if (result.rows.length > 0) {
      return NextResponse.json({ connected: true, data: result.rows[0].data });
    }
  }

  // Get most recent case
  const allCases = await executeNeonQuery(
    `SELECT data FROM recovery_cases ORDER BY updated_at DESC LIMIT 1`
  );

  return NextResponse.json({
    connected: true,
    data: allCases.rows.length > 0 ? allCases.rows[0].data : null,
  });
}

export async function POST(req: NextRequest) {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    return NextResponse.json({ connected: false, message: 'DATABASE_URL not configured' });
  }

  await ensureNeonTables();

  try {
    const body: RecoveryCase = await req.json();
    if (!body || !body.id) {
      return NextResponse.json({ error: 'Invalid RecoveryCase payload' }, { status: 400 });
    }

    const userId = (body as any).userId || (body as any).user_id || null;

    // Upsert into recovery_cases
    await executeNeonQuery(
      `INSERT INTO recovery_cases (
        id, user_id, patient_name, surgery_date, surgery_type, surgery_leg,
        current_phase, weight_bearing_status, brace_requirement, max_safe_flexion,
        data, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        user_id = COALESCE(EXCLUDED.user_id, recovery_cases.user_id),
        patient_name = EXCLUDED.patient_name,
        surgery_date = EXCLUDED.surgery_date,
        surgery_type = EXCLUDED.surgery_type,
        surgery_leg = EXCLUDED.surgery_leg,
        current_phase = EXCLUDED.current_phase,
        weight_bearing_status = EXCLUDED.weight_bearing_status,
        brace_requirement = EXCLUDED.brace_requirement,
        max_safe_flexion = EXCLUDED.max_safe_flexion,
        data = EXCLUDED.data,
        updated_at = CURRENT_TIMESTAMP;`,
      [
        body.id,
        userId,
        body.patientName,
        body.surgeryDate,
        body.surgeryType,
        body.surgeryLeg,
        body.currentPhase,
        body.weightBearingStatus,
        body.braceRequirement,
        body.maxSafeFlexion,
        JSON.stringify(body),
      ]
    );

    // Also sync latest ROM if exists
    if (body.romHistory && body.romHistory.length > 0) {
      const latestRom = body.romHistory[0];
      await executeNeonQuery(
        `INSERT INTO rom_measurements (
          id, recovery_case_id, flexion_angle, extension_angle, leg, is_safe, safe_limit, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING;`,
        [
          latestRom.id,
          body.id,
          latestRom.flexionAngle,
          latestRom.extensionAngle,
          latestRom.leg,
          latestRom.isSafe,
          latestRom.safeLimit,
          latestRom.source,
        ]
      );
    }

    // Also sync latest Daily Log if exists
    if (body.dailyLogs && body.dailyLogs.length > 0) {
      const latestLog = body.dailyLogs[0];
      await executeNeonQuery(
        `INSERT INTO recovery_logs (
          id, recovery_case_id, log_date, pain_score, swelling_level, ice_done, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING;`,
        [
          latestLog.id,
          body.id,
          latestLog.date,
          latestLog.painScore,
          latestLog.swellingLevel,
          latestLog.iceDone,
          latestLog.patientNotes,
        ]
      );
    }

    return NextResponse.json({ success: true, connected: true });
  } catch (err: any) {
    console.warn('Sync post error:', err);
    return NextResponse.json({ error: err.message || 'Sync error' }, { status: 500 });
  }
}
