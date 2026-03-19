import db from '../config/database';

/**
 * Fallback JS-side number generator if DB triggers are not used.
 * Generates human-readable IDs like DR-2026-00001.
 */
export async function generateNumber(
  prefix: string,
  sequenceName: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.raw(`SELECT nextval('${sequenceName}') AS seq`);
  const seq = result.rows[0].seq;
  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
}
