export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.FAL_KEY || '';
  return Response.json({
    ok: Boolean(key),
    keyConfigured: Boolean(key),
    keyLooksValid: key.includes(':') && key.length > 20,
    service: 'fal'
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
