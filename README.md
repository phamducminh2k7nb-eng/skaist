# MOVA AI Studio

MOVA converts a character image + a driving dance video into a new motion-transfer video using `fal-ai/wan-motion`.

## Stack
- Next.js App Router
- React + TypeScript
- fal.ai Wan Motion
- Secure fal server proxy
- Responsive dark creative-studio UI

## Color system
- Night Ink: `#070A12`
- Deep Panel: `#0D1220`
- Elevated Panel: `#11182A`
- Border Slate: `#232D46`
- Soft White: `#F5F7FB`
- Muted Steel: `#9CA8BF`
- Electric Violet: `#7C5CFC`
- Motion Cyan: `#2DD4FF`
- Success Mint: `#39E58C`
- Warning Amber: `#FFB84D`
- Error Coral: `#FF5D73`

## Run locally
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`
3. Add your fal key: `FAL_KEY=...`
4. Run: `npm run dev`
5. Open `http://localhost:3000`

## Deploy
Deploy to a Next.js-compatible host such as Vercel and add `FAL_KEY` as a server environment variable.

## Security note
The fal API key is never placed in client-side source. Calls are routed through `/api/fal/proxy` and restricted to the `fal-ai/wan-motion` endpoint. Before a public paid launch, add user authentication, rate limiting, per-user quotas, billing controls, and abuse monitoring so strangers cannot consume your fal credits.

## Input guidance
Use a clear full-body character image. Driving videos work best when the dancer is fully visible, with limited occlusion and a stable camera.
