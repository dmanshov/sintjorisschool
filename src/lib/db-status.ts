/**
 * Classifies database failures so the site can respond usefully instead of
 * returning a 500 with a stack trace.
 *
 * The distinction that matters on a fresh deployment: a database that is
 * reachable but has no tables yet is a *setup* problem with an exact fix, while
 * a database that cannot be reached is an *outage*. Both used to look identical
 * to a visitor.
 */
export type DbFailure = 'not-initialised' | 'unavailable' | null;

/** Postgres: 42P01 undefined_table, 3F000 invalid_schema_name, 3D000 invalid_catalog_name. */
const NOT_INITIALISED_CODES = new Set(['42P01', '3F000', '3D000']);

function chain(error: unknown): unknown[] {
  const parts: unknown[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current);
    current = current.cause;
  }
  if (current) parts.push(current);
  return parts;
}

export function classifyDbError(error: unknown): DbFailure {
  for (const link of chain(error)) {
    const code = (link as { code?: unknown })?.code;
    if (typeof code === 'string') {
      if (NOT_INITIALISED_CODES.has(code)) return 'not-initialised';
      // Connection-level failures from node-postgres / undici.
      if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) {
        return 'unavailable';
      }
    }
    const message = (link as { message?: unknown })?.message;
    if (typeof message === 'string') {
      if (/relation .* does not exist|does not exist/i.test(message) && /relation/i.test(message)) {
        return 'not-initialised';
      }
      if (/fetch failed|connect|timeout|terminated|socket hang up/i.test(message)) {
        return 'unavailable';
      }
    }
  }
  return null;
}

/**
 * Runs a read and falls back rather than taking the whole page down.
 *
 * Reads only. Writes must never be swallowed: a server action that silently
 * "succeeds" without persisting is worse than an error message. The failure is
 * logged at error level so it is visible in the host's logs — degrading quietly
 * and *invisibly* would just hide an outage.
 */
export async function safeRead<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<{ value: T; failure: DbFailure }> {
  try {
    return { value: await run(), failure: null };
  } catch (error) {
    const failure = classifyDbError(error);
    if (!failure) throw error;

    console.error(
      failure === 'not-initialised'
        ? `[db] ${label}: the database has no schema yet. Run "npm run db:apply" against it.`
        : `[db] ${label}: the database could not be reached.`,
      error,
    );
    return { value: fallback, failure };
  }
}
