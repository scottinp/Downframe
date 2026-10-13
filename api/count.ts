// Vercel Function: the public "files converted" total, one Redis key in Upstash (added in Vercel → Storage).
// Only a number arrives here; preset files never leave the browser.

// The env names depend on how the store was connected; accept both.
const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "converted";
export const MAX_ADD = 100; // shortcut: anyone can still inflate the total 100 at a time; add rate limiting if that happens

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

// A POST body must be { n } with n a whole number from 1 to MAX_ADD; anything else is rejected.
export function parseAdd(body: unknown): number | null {
  const n = (body as { n?: unknown } | null)?.n;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_ADD ? n : null;
}

export async function GET() {
  if (!REDIS_URL || !REDIS_TOKEN) return new Response(null, { status: 503 });
  try {
    const total = Number((await redis(["GET", KEY])) ?? 0);
    // Cached at Vercel's edge for a minute, so page views don't each cost a Redis command.
    return Response.json({ total }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!REDIS_URL || !REDIS_TOKEN) return new Response(null, { status: 503 });
  const n = parseAdd(await request.json().catch(() => null));
  if (n === null) return new Response(null, { status: 400 });
  try {
    return Response.json({ total: Number(await redis(["INCRBY", KEY, n])) });
  } catch {
    return new Response(null, { status: 502 });
  }
}
