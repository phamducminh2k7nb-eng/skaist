export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.FAL_KEY || '';
  if (!key) {
    return Response.json({
      ok: false,
      keyConfigured: false,
      keyValid: false,
      reason: 'FAL_KEY is missing in Vercel Production.'
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const response = await fetch('https://api.fal.ai/v1/models?limit=1', {
      headers: { Authorization: `Key ${key}` },
      cache: 'no-store'
    });

    if (response.ok) {
      return Response.json({
        ok: true,
        keyConfigured: true,
        keyValid: true,
        service: 'fal'
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    let detail = '';
    try {
      const body = await response.text();
      detail = body.slice(0, 400);
    } catch {}

    return Response.json({
      ok: false,
      keyConfigured: true,
      keyValid: false,
      status: response.status,
      reason: response.status === 401
        ? 'FAL_KEY is invalid or revoked.'
        : response.status === 403
          ? 'FAL_KEY does not have the required API scope.'
          : `fal authentication check failed (${response.status}).`,
      detail
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({
      ok: false,
      keyConfigured: true,
      keyValid: false,
      reason: error instanceof Error ? error.message : 'Could not reach fal.'
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
