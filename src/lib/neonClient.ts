/**
 * AXVYRA Neon Serverless PostgreSQL Client
 * Uses native HTTP fetch for zero bundle overhead and zero cold-start on Vercel.
 */

export interface QueryResult<T = any> {
  rows: T[];
  rowCount?: number;
}

export function getDatabaseUrl(): string | null {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    null
  );
}

export async function executeNeonQuery<T = any>(
  sqlQuery: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    return { rows: [] };
  }

  try {
    const url = new URL(connectionString.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
    const host = url.host;

    // Neon native HTTP SQL endpoint
    const endpoint = `https://${host}/sql`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': connectionString,
      },
      body: JSON.stringify({
        query: sqlQuery,
        params,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Neon query error response:', errText);
      return { rows: [] };
    }

    const data = await res.json();
    return {
      rows: data.rows || [],
      rowCount: data.rowCount,
    };
  } catch (err) {
    console.warn('executeNeonQuery failed:', err);
    return { rows: [] };
  }
}

let dbInitialized = false;

export async function ensureNeonTables(): Promise<boolean> {
  if (dbInitialized) return true;
  const connectionString = getDatabaseUrl();
  if (!connectionString) return false;

  const initSql = `
    CREATE TABLE IF NOT EXISTS recovery_cases (
      id TEXT PRIMARY KEY,
      patient_name TEXT NOT NULL,
      surgery_date TEXT NOT NULL,
      surgery_type TEXT NOT NULL,
      surgery_leg TEXT NOT NULL,
      current_phase INT NOT NULL,
      weight_bearing_status TEXT,
      brace_requirement TEXT,
      max_safe_flexion INT,
      data JSONB,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recovery_logs (
      id TEXT PRIMARY KEY,
      recovery_case_id TEXT,
      log_date TEXT,
      pain_score INT,
      swelling_level TEXT,
      ice_done BOOLEAN,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rom_measurements (
      id TEXT PRIMARY KEY,
      recovery_case_id TEXT,
      flexion_angle INT,
      extension_angle INT,
      leg TEXT,
      is_safe BOOLEAN,
      safe_limit INT,
      source TEXT,
      recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exercise_sessions (
      id TEXT PRIMARY KEY,
      recovery_case_id TEXT,
      session_title TEXT,
      rpe_score INT,
      pain_score INT,
      notes TEXT,
      completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await executeNeonQuery(initSql);
    dbInitialized = true;
    return true;
  } catch (e) {
    console.warn('ensureNeonTables error', e);
    return false;
  }
}
