import { createRouteHandler } from '@fal-ai/server-proxy/nextjs';

// Do not restrict allowedEndpoints here: fal.storage.upload() uses a separate
// fal storage target before the model queue request. The server proxy itself
// still only forwards trusted fal domains and keeps FAL_KEY on the server.
export const { GET, POST, PUT } = createRouteHandler();
