import { createRouteHandler } from '@fal-ai/server-proxy/nextjs';

export const { GET, POST, PUT } = createRouteHandler({
  allowedEndpoints: [
    'fal-ai/wan-motion',
    'fal-ai/bytedance-upscaler/upscale/video'
  ],
  allowUnauthorizedRequests: true
});
