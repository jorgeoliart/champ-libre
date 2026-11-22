import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAggregatedArticles, getCacheHealth } from './server/aggregator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction =
  process.env.NODE_ENV === 'production' || __filename.endsWith('server.js');

const PORT = Number(process.env.PORT) || (isProduction ? 3001 : 3000);

async function startServer() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/api', (req, _res, next) => {
    console.log('[API Request]', req.method, req.originalUrl);
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json(getCacheHealth());
  });

  app.get('/api/articles', async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const data = await getAggregatedArticles(forceRefresh);
      console.log(`[API] Returning ${data.articles.length} articles`);
      res.json(data);
    } catch (error) {
      console.error('[API] Erreur lors de l’agrégation des articles:', error);
      res.status(500).json({
        error: 'Impossible de récupérer les articles pour le moment.',
      });
    }
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route API introuvable.' });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { maxAge: '1h' }));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Champ Libre] Serveur actif sur http://0.0.0.0:${PORT}`);
    // Pre-warm RSS cache in background on boot
    void getAggregatedArticles().catch((err) => {
      console.warn('[Champ Libre] Préchargement RSS différé:', err);
    });
  });
}

startServer().catch((err) => {
  console.error('[Champ Libre] Échec du démarrage du serveur:', err);
  process.exit(1);
});
