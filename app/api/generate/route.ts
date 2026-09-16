import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const key = process.env.FAL_KEY;
    if (!key) {
      return NextResponse.json({ error: 'AI service is not configured. Add FAL_KEY to the server environment.' }, { status: 503 });
    }

    fal.config({ credentials: key });
    const form = await request.formData();
    const image = form.get('image');
    const video = form.get('video');
    const prompt = String(form.get('prompt') || '');
    const adaptMotion = String(form.get('adaptMotion')) !== 'false';
    const enhanceIdentity = String(form.get('enhanceIdentity')) === 'true';

    if (!(image instanceof File) || !(video instanceof File)) {
      return NextResponse.json({ error: 'Missing character image or motion video.' }, { status: 400 });
    }
    if (!image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Character file must be an image.' }, { status: 400 });
    }
    if (!video.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Motion reference must be a video.' }, { status: 400 });
    }
    if (image.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image is too large. Maximum 20 MB.' }, { status: 413 });
    }
    if (video.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Video is too large. Maximum 100 MB.' }, { status: 413 });
    }

    const [imageUrl, videoUrl] = await Promise.all([
      fal.storage.upload(image),
      fal.storage.upload(video)
    ]);

    const result = await fal.subscribe('fal-ai/wan-motion', {
      input: {
        image_url: imageUrl,
        video_url: videoUrl,
        prompt,
        acceleration: 'regular',
        adapt_motion: adaptMotion,
        enhance_identity: enhanceIdentity,
        enable_safety_checker: true
      },
      logs: true
    });

    const data = result.data as { video?: { url?: string }; seed?: number };
    const generatedUrl = data?.video?.url;
    if (!generatedUrl) throw new Error('The AI engine returned no video URL.');

    return NextResponse.json({ videoUrl: generatedUrl, requestId: result.requestId, seed: data.seed });
  } catch (error) {
    console.error('MOVA generation error', error);
    const message = error instanceof Error ? error.message : 'Video generation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
