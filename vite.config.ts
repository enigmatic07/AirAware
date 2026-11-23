import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Local development middleware for Vercel Serverless Functions in /api/
 * This enables `npm run dev` to serve /api/assistant and /api/recommendations seamlessly
 * with the exact same server-side logic and environment variables as Vercel production.
 */
function vercelApiDevPlugin(): Plugin {
  return {
    name: 'vercel-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const expressLikeRes = res as any;
        expressLikeRes.status = (statusCode: number) => {
          expressLikeRes.statusCode = statusCode;
          return expressLikeRes;
        };
        expressLikeRes.json = (body: any) => {
          expressLikeRes.setHeader('Content-Type', 'application/json');
          expressLikeRes.end(JSON.stringify(body));
          return expressLikeRes;
        };

        const parsedUrl = new URL(req.url, 'http://localhost:5173');
        const pathname = parsedUrl.pathname;

        try {
          if (pathname === '/api/assistant') {
            const { default: handler } = await server.ssrLoadModule('/api/assistant.ts');
            await handler(req, expressLikeRes);
            return;
          }
          if (pathname === '/api/recommendations') {
            const { default: handler } = await server.ssrLoadModule('/api/recommendations.ts');
            await handler(req, expressLikeRes);
            return;
          }
        } catch (err: any) {
          console.error('[ApiDevMiddleware Error]:', err);
          expressLikeRes.status(500).json({
            success: false,
            error: err.message || 'Internal dev server error',
            code: 'INTERNAL_ERROR',
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), vercelApiDevPlugin()],
});
