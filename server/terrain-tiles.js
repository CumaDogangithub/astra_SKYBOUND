// A deliberately narrow relay for the public Mapzen height tiles. The upstream
// bucket does not expose browser CORS headers; no credentials are needed.
const cache = new Map();
const pending = new Map();
const MAX_CACHE_BYTES = 24 * 1024 * 1024;
let cacheBytes = 0;
export function parseTerrainPath(pathname) {
  const match = /^\/map-tiles\/elevation\/(\d{1,2})\/(\d+)\/(\d+)\.png$/.exec(pathname);
  if (!match) return null;
  const [zoom, x, y] = match.slice(1).map(Number);
  if (zoom > 15 || x >= 2 ** zoom || y >= 2 ** zoom) return null;
  return { zoom, x, y };
}
async function loadTile(tile) {
  const key = `${tile.zoom}/${tile.x}/${tile.y}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    cache.delete(key); cache.set(key, hit); return hit;
  }
  if (hit) { cacheBytes -= hit.data.length; cache.delete(key); }
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
    const response = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`, {
      signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Skybound-Flight-Simulator/1.0' },
    });
    if (!response.ok) throw new Error(`Elevation source: ${response.status}`);
    if (!response.headers.get('content-type')?.includes('image/png')) throw new Error('Unexpected elevation content');
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > 1024 * 1024) throw new Error('Unexpected elevation size');
    const entry = { data, etag: response.headers.get('etag'), expires: Date.now() + 7 * 86400000 };
    cache.set(key, entry); cacheBytes += data.length;
    while (cacheBytes > MAX_CACHE_BYTES && cache.size > 1) {
      const oldest = cache.keys().next().value; cacheBytes -= cache.get(oldest).data.length; cache.delete(oldest);
    }
    return entry;
  })().finally(() => pending.delete(key));
  pending.set(key, job); return job;
}
export async function terrainTileMiddleware(req, res, next = () => {}) {
  const pathname = (req.url || '').split('?')[0];
  if (!pathname.startsWith('/map-tiles/')) return next();
  const tile = parseTerrainPath(pathname);
  if (!tile || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Geçersiz harita parçası.'); return;
  }
  try {
    const entry = await loadTile(tile);
    const headers = { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800', 'X-Content-Type-Options': 'nosniff' };
    if (entry.etag) headers.ETag = entry.etag;
    if (entry.etag && req.headers['if-none-match'] === entry.etag) { res.writeHead(304, headers); res.end(); return; }
    res.writeHead(200, { ...headers, 'Content-Length': entry.data.length });
    res.end(req.method === 'HEAD' ? undefined : entry.data);
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Yükseklik verisi şu anda yüklenemedi. Yeniden deneyin.');
  }
}
