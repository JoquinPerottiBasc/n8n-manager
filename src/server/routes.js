import { Router } from 'express';
import { loadConfig, addClient, removeClient, getClient } from '../config/store.js';
import { apiRequest, fetchAllPages } from '../api/client.js';
import { ClientNotFoundError, ApiError } from '../utils/errors.js';

const router = Router();

function handleError(res, err) {
  if (err instanceof ClientNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof ApiError) {
    return res.status(err.status || 500).json({ error: err.message, details: err.data });
  }
  return res.status(500).json({ error: err.message });
}

// GET /api/clients
router.get('/clients', (_req, res) => {
  const config = loadConfig();
  res.json(config.clients.map(c => ({ name: c.name, url: c.url })));
});

// POST /api/clients — body: { name, url, apiKey }
router.post('/clients', async (req, res) => {
  const { name, url, apiKey } = req.body;
  if (!name || !url || !apiKey) {
    return res.status(400).json({ error: 'Se requieren nombre, URL y API Key' });
  }
  const client = { name, url, apiKey };
  // Probar conectividad
  try {
    await apiRequest(client, 'GET', '/workflows', { params: { limit: 1 } });
  } catch (err) {
    return res.status(400).json({ error: `No se pudo conectar: ${err.message}` });
  }
  addClient(client);
  res.json({ ok: true, name });
});

// DELETE /api/clients/:name
router.delete('/clients/:name', (req, res) => {
  try {
    removeClient(req.params.name);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/clients/:name/workflows
router.get('/clients/:name/workflows', async (req, res) => {
  try {
    const client = getClient(req.params.name);
    const workflows = await fetchAllPages(client, '/workflows');
    res.json(workflows);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/clients/:name/workflows/:id/activate
router.post('/clients/:name/workflows/:id/activate', async (req, res) => {
  try {
    const client = getClient(req.params.name);
    await apiRequest(client, 'POST', `/workflows/${req.params.id}/activate`);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/clients/:name/workflows/:id/deactivate
router.post('/clients/:name/workflows/:id/deactivate', async (req, res) => {
  try {
    const client = getClient(req.params.name);
    await apiRequest(client, 'POST', `/workflows/${req.params.id}/deactivate`);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/clients/:name/executions?limit=20
router.get('/clients/:name/executions', async (req, res) => {
  try {
    const client = getClient(req.params.name);
    const limit = parseInt(req.query.limit) || 20;
    const data = await apiRequest(client, 'GET', '/executions', {
      params: { limit, includeData: false },
    });
    const items = Array.isArray(data) ? data : (data.data ?? []);
    res.json(items);
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
