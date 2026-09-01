const JWT_CLOCK_ERROR_CODE = 'PGRST303';
const DEFAULT_CLOCK_WAIT_MS = 2_500;
const MIN_CLOCK_WAIT_MS = 1_500;
const MAX_CLOCK_WAIT_MS = 15_000;

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

function getAuthorizationHeader(input: RequestInfo | URL, init?: RequestInit): string | null {
  const initHeader = new Headers(init?.headers).get('authorization');
  if (initHeader) return initHeader;
  return typeof Request !== 'undefined' && input instanceof Request
    ? input.headers.get('authorization')
    : null;
}

function getJwtIssuedAtMilliseconds(authorization: string | null): number | null {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const payload = token?.split('.')[1];
  if (!payload || typeof globalThis.atob !== 'function') return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(globalThis.atob(padded)) as { iat?: number };
    return typeof decoded.iat === 'number' ? decoded.iat * 1000 : null;
  } catch {
    return null;
  }
}

async function isJwtClockResponse(response: Response): Promise<boolean> {
  if (response.ok) return false;
  try {
    const body = await response.clone().json() as { code?: string; message?: string };
    return body.code === JWT_CLOCK_ERROR_CODE
      && body.message?.toLocaleLowerCase().includes('jwt issued at future') === true;
  } catch {
    return false;
  }
}

/**
 * Supabase Auth and PostgREST can occasionally differ by a few seconds. In that
 * narrow case PostgREST rejects a newly refreshed JWT before executing the request.
 * Wait until its `iat` is usable and retry that rejected request exactly once.
 */
export function createSupabaseFetch(): typeof fetch {
  const nativeFetch = globalThis.fetch.bind(globalThis);

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await nativeFetch(input, init);
    if (!await isJwtClockResponse(response)) return response;

    const issuedAt = getJwtIssuedAtMilliseconds(getAuthorizationHeader(input, init));
    const waitMilliseconds = issuedAt === null
      ? DEFAULT_CLOCK_WAIT_MS
      : Math.min(MAX_CLOCK_WAIT_MS, Math.max(MIN_CLOCK_WAIT_MS, issuedAt - Date.now() + MIN_CLOCK_WAIT_MS));

    await wait(waitMilliseconds);
    return nativeFetch(input, init);
  };
}
