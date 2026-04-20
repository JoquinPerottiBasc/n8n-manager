import axios from 'axios';
import { ApiError } from '../utils/errors.js';

function buildHeaders(client) {
  return {
    'X-N8N-API-KEY': client.apiKey,
    'Content-Type': 'application/json',
  };
}

export async function apiRequest(client, method, path, opts = {}) {
  const url = `${client.url.replace(/\/$/, '')}/api/v1${path}`;
  try {
    const response = await axios({
      method,
      url,
      headers: buildHeaders(client),
      params: opts.params,
      data: opts.data,
    });
    return response.data;
  } catch (err) {
    if (err.response) {
      const msg =
        err.response.data?.message ||
        err.response.data?.error ||
        `HTTP ${err.response.status}`;
      throw new ApiError(msg, err.response.status, err.response.data);
    }
    throw new ApiError(err.message, null, null);
  }
}

export async function fetchAllPages(client, path, params = {}) {
  const results = [];
  let cursor = undefined;

  do {
    const query = { ...params, limit: 100 };
    if (cursor) query.cursor = cursor;

    const data = await apiRequest(client, 'GET', path, { params: query });

    const items = Array.isArray(data) ? data : (data.data ?? []);
    results.push(...items);

    cursor = data.nextCursor ?? data.cursor ?? null;
  } while (cursor);

  return results;
}
