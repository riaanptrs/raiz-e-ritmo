import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = 'dist';
function walk(folder) {
  return readdirSync(folder).flatMap(name => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const files = walk(root).filter(p => !p.endsWith('/sw.js')).sort();
const hash = createHash('sha256');
for (const path of files) hash.update(relative(root, path)).update(readFileSync(path));
const version = hash.digest('hex').slice(0, 16);
const assets = files.map(path => relative(root, path).replaceAll('\\', '/'));
const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons ?? []) {
  if (!assets.includes(icon.src)) throw new Error(`Manifest icon missing from build: ${icon.src}`);
}
const worker = `/* Generated from this build's exact assets. Do not edit dist manually. */
const CACHE_PREFIX = 'raiz-e-ritmo-v1-';
const CACHE = CACHE_PREFIX + '${version}';
const BASE = new URL('./', self.location.href);
const ASSETS = ${JSON.stringify(assets)}.map(path => new URL(path, BASE).href);
const BUILD_ASSETS = new Set(ASSETS);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const canonical = new URL(request.url);
    canonical.search = '';
    // Only immutable build files are cached. Hosting headers such as Vary: Origin
    // must not prevent a module request matching its headerless precache request.
    // Do not extend ignoreVary to authenticated or dynamically cached responses.
    const cached = BUILD_ASSETS.has(canonical.href)
      ? await cache.match(request, { ignoreSearch: true, ignoreVary: true })
      : undefined;
    if (request.mode !== 'navigate' && cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) return response;
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await cache.match(new URL('index.html', BASE).href, { ignoreVary: true });
        if (shell) return shell;
      }
      return response;
    } catch (error) {
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await cache.match(new URL('index.html', BASE).href, { ignoreVary: true });
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
`;
writeFileSync(join(root, 'sw.js'), worker);
console.log(`Offline bundle ${version}: ${assets.length} precached assets under /raiz-e-ritmo/.`);
