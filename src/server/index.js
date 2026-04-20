import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRouter from './routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '../../public');

const AUTH_ENABLED = !!(process.env.DASHBOARD_USER && process.env.DASHBOARD_PASS);

function requireAuth(req, res, next) {
  if (!AUTH_ENABLED || req.session?.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autorizado' });
  res.sendFile(join(PUBLIC_DIR, 'index.html'));
}

export function createServer() {
  const app = express();

  app.use(session({
    secret: process.env.SESSION_SECRET || 'n8n-manager-local-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  }));

  app.use(express.json());

  app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!AUTH_ENABLED) return res.json({ ok: true });
    if (username === process.env.DASHBOARD_USER && password === process.env.DASHBOARD_PASS) {
      req.session.authenticated = true;
      res.json({ ok: true });
    } else {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
  });

  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get('/auth/status', (req, res) => {
    res.json({ authEnabled: AUTH_ENABLED, authenticated: !AUTH_ENABLED || !!req.session?.authenticated });
  });

  app.use('/api', requireAuth, apiRouter);
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (_req, res) => {
    res.sendFile(join(PUBLIC_DIR, 'index.html'));
  });
  return app;
}

export async function startServer(port, openBrowser) {
  const app = createServer();
  const url = `http://localhost:${port}`;

  return new Promise((resolve, reject) => {
    const server = app.listen(port, async () => {
      console.log(`\x1b[32m✓ Dashboard corriendo en ${url}\x1b[0m`);
      if (openBrowser) {
        try {
          const { default: open } = await import('open');
          await open(url);
        } catch {
          // Si no se puede abrir el navegador, no es un error crítico
        }
      }
      resolve(server);
    });
    server.on('error', reject);
  });
}
