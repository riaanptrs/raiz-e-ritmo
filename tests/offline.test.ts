import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// Exercise the actual generated worker against a small HTTP/cache harness.
// This checks offline behavior without pretending to be a browser or starting a server.
const buildScript = fileURLToPath(new URL('../scripts/build-service-worker.mjs', import.meta.url));
const workerUrl = 'https://example.test/raiz-e-ritmo/sw.js';
const shell = '<!doctype html><h1>Fixture calendar</h1><script src="./assets/calendar.js"></script>';
const fixtureFiles: Record<string, string> = {
  'index.html': shell,
  'assets/calendar.js': 'window.fixtureCalendar = "first build";',
  'data/events.json': '{"year":2027,"events":["fixture"]}',
  'manifest.webmanifest': '{"start_url":"./","scope":"./"}',
};
const temporaryFolders: string[] = [];

type RequestLike = { url: string; method: string; mode: string; headers: Headers };
type CacheEntry = { response: Response; requestHeaders: Headers };
type CacheStore = Map<string, Map<string, CacheEntry>>;
type WorkerListener = (event: Record<string, unknown>) => void;

function makeBuild() {
  const folder = mkdtempSync(join(tmpdir(), 'raiz-offline-test-'));
  temporaryFolders.push(folder);
  for (const [path, content] of Object.entries(fixtureFiles)) {
    mkdirSync(dirname(join(folder, 'dist', path)), { recursive: true });
    writeFileSync(join(folder, 'dist', path), content);
  }
  function generate() {
    execFileSync(process.execPath, [buildScript], { cwd: folder, stdio: 'pipe' });
    return readFileSync(join(folder, 'dist', 'sw.js'), 'utf8');
  }
  return { folder, generate };
}

function request(url: string, mode = 'navigate', method = 'GET', headers: Record<string, string> = {}): RequestLike {
  return { url: new URL(url, workerUrl).href, method, mode, headers: new Headers(headers) };
}

function loadWorker(code: string, options: { store?: CacheStore; files?: Record<string, string>; offline?: boolean; responseHeaders?: Record<string, string> } = {}) {
  const listeners = new Map<string, WorkerListener>();
  const store: CacheStore = options.store ?? new Map();
  let offline = options.offline ?? false;
  const responses = new Map(Object.entries(options.files ?? fixtureFiles).map(([path, content]) => [new URL(path, workerUrl).href, content]));
  const networkFetch = vi.fn(async (input: RequestLike | string) => {
    if (offline) throw new TypeError('Fixture network unavailable');
    const url = typeof input === 'string' ? input : input.url;
    const content = responses.get(url);
    return content === undefined ? new Response('not found', { status: 404 }) : new Response(content, { status: 200, headers: options.responseHeaders });
  });
  const clientsClaim = vi.fn(async () => undefined);
  const skipWaiting = vi.fn(async () => undefined);
  const caches = {
    async open(name: string) {
      if (!store.has(name)) store.set(name, new Map());
      const entries = store.get(name)!;
      return {
        async addAll(urls: string[]) {
          // Cache.addAll is atomic: a failed required asset rejects installation.
          const downloaded = await Promise.all(urls.map(async url => {
            const response = await networkFetch(url);
            if (!response.ok) throw new TypeError(`Precache failed for ${url}`);
            return [url, response] as const;
          }));
          for (const [url, response] of downloaded) entries.set(url, { response, requestHeaders: new Headers() });
        },
        async match(input: RequestLike | string, matchOptions?: { ignoreSearch?: boolean; ignoreVary?: boolean }) {
          const wanted = new URL(typeof input === 'string' ? input : input.url);
          const requestHeaders = typeof input === 'string' ? new Headers() : input.headers;
          if (matchOptions?.ignoreSearch) wanted.search = '';
          for (const [url, entry] of entries) {
            const key = new URL(url);
            if (matchOptions?.ignoreSearch) key.search = '';
            if (key.href !== wanted.href) continue;
            if (!matchOptions?.ignoreVary) {
              const vary = entry.response.headers.get('vary')?.split(',').map(value => value.trim().toLowerCase()).filter(Boolean) ?? [];
              if (vary.includes('*') || vary.some(name => entry.requestHeaders.get(name) !== requestHeaders.get(name))) continue;
            }
            return entry.response.clone();
          }
          return undefined;
        },
      };
    },
    async keys() { return [...store.keys()]; },
    async delete(name: string) { return store.delete(name); },
  };
  runInNewContext(code, {
    URL,
    fetch: networkFetch,
    caches,
    self: {
      location: { href: workerUrl },
      addEventListener(name: string, listener: WorkerListener) { listeners.set(name, listener); },
      clients: { claim: clientsClaim },
      skipWaiting,
    },
  });

  return {
    store, networkFetch, clientsClaim, skipWaiting,
    setOffline(value: boolean) { offline = value; },
    setResponse(url: string, content: string) { responses.set(new URL(url, workerUrl).href, content); },
    async lifecycle(name: 'install' | 'activate') {
      const promises: Promise<unknown>[] = [];
      listeners.get(name)!({ waitUntil(value: Promise<unknown>) { promises.push(value); } });
      await Promise.all(promises);
    },
    async fetch(input: RequestLike): Promise<Response | undefined> {
      let intercepted: Promise<Response> | undefined;
      listeners.get('fetch')!({
        request: input,
        respondWith(value: Promise<Response>) { intercepted = value; },
      });
      return intercepted ? await intercepted : undefined;
    },
    message(data: unknown) { listeners.get('message')!({ data }); },
  };
}

afterEach(() => {
  for (const folder of temporaryFolders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe('generated offline bundle', () => {
  it('precaches the complete build at the repository subpath, including data and nested assets', async () => {
    const build = makeBuild();
    const worker = loadWorker(build.generate());
    await worker.lifecycle('install');
    expect(worker.store.size).toBe(1);
    const cached = [...worker.store.values()][0];
    expect([...cached.keys()].sort()).toEqual(Object.keys(fixtureFiles).map(path => new URL(path, workerUrl).href).sort());
    expect([...cached.keys()].some(url => url.endsWith('/sw.js'))).toBe(false);
    expect(worker.clientsClaim).not.toHaveBeenCalled();
    expect(worker.skipWaiting).not.toHaveBeenCalled();
  });

  it('serves a previously installed shell and its JS/data without a connection', async () => {
    const worker = loadWorker(makeBuild().generate());
    await worker.lifecycle('install');
    await worker.lifecycle('activate');
    worker.setOffline(true);
    expect(await (await worker.fetch(request('/raiz-e-ritmo/')))?.text()).toBe(shell);
    expect(await (await worker.fetch(request('/raiz-e-ritmo/calendar/day/2027-06-18')))?.text()).toBe(shell);
    worker.networkFetch.mockClear();
    expect(await (await worker.fetch(request('/raiz-e-ritmo/assets/calendar.js?v=reader', 'same-origin')))?.text()).toBe(fixtureFiles['assets/calendar.js']);
    expect(await (await worker.fetch(request('/raiz-e-ritmo/data/events.json', 'same-origin')))?.json()).toEqual({ year: 2027, events: ['fixture'] });
    expect(worker.networkFetch).not.toHaveBeenCalled();
    expect(worker.clientsClaim).toHaveBeenCalledOnce();
  });

  it('uses online navigation responses and falls back to the shell for an unavailable route', async () => {
    const worker = loadWorker(makeBuild().generate());
    await worker.lifecycle('install');
    worker.setResponse('/raiz-e-ritmo/', '<h1>New online shell</h1>');
    expect(await (await worker.fetch(request('/raiz-e-ritmo/')))?.text()).toBe('<h1>New online shell</h1>');
    expect(await (await worker.fetch(request('/raiz-e-ritmo/unknown-route')))?.text()).toBe(shell);
    const missingAsset = await worker.fetch(request('/raiz-e-ritmo/assets/missing.js', 'same-origin'));
    expect(missingAsset?.status).toBe(404);
    expect(await missingAsset?.text()).toBe('not found');
  });

  it('serves precached static modules offline despite host Vary headers and browser request headers', async () => {
    // Vite preview adds Vary: Origin. A module-script request can have Origin
    // and Sec-Fetch-Dest headers that were absent from cache.addAll's requests.
    const worker = loadWorker(makeBuild().generate(), { responseHeaders: { Vary: 'Origin, Sec-Fetch-Dest' } });
    await worker.lifecycle('install');
    worker.setOffline(true);
    worker.networkFetch.mockClear();
    const module = await worker.fetch(request('/raiz-e-ritmo/assets/calendar.js', 'cors', 'GET', {
      Origin: 'https://example.test', 'Sec-Fetch-Dest': 'script',
    }));
    expect(await module?.text()).toBe(fixtureFiles['assets/calendar.js']);
    expect(worker.networkFetch).not.toHaveBeenCalled();
    const document = await worker.fetch(request('/raiz-e-ritmo/index.html?offline-check=1', 'navigate', 'GET', {
      'Sec-Fetch-Dest': 'document',
    }));
    expect(await document?.text()).toBe(shell);
  });

  it('leaves external, sibling-site and non-GET requests to the browser', async () => {
    const worker = loadWorker(makeBuild().generate());
    await worker.lifecycle('install');
    worker.networkFetch.mockClear();
    const excluded = [
      request('https://other.test/raiz-e-ritmo/index.html'),
      request('/another-project/index.html'),
      request('/raiz-e-ritmo-extra/index.html'),
      request('/raiz-e-ritmo/data/events.json', 'same-origin', 'POST'),
    ];
    for (const input of excluded) expect(await worker.fetch(input)).toBeUndefined();
    expect(worker.networkFetch).not.toHaveBeenCalled();
  });

  it('changes the cache when asset content changes and preserves unrelated caches on activation', async () => {
    const build = makeBuild();
    const firstCode = build.generate();
    expect(build.generate()).toBe(firstCode); // An existing sw.js cannot change its own build fingerprint.
    const oldWorker = loadWorker(firstCode);
    await oldWorker.lifecycle('install');
    const previousKey = [...oldWorker.store.keys()][0];
    oldWorker.store.set('some-other-app-cache', new Map([['https://example.test/other/', { response: new Response('keep me'), requestHeaders: new Headers() }]]));
    const secondFiles = { ...fixtureFiles, 'assets/calendar.js': 'window.fixtureCalendar = "second build";' };
    writeFileSync(join(build.folder, 'dist/assets/calendar.js'), secondFiles['assets/calendar.js']);
    const newWorker = loadWorker(build.generate(), { store: oldWorker.store, files: secondFiles });
    await newWorker.lifecycle('install');
    expect(newWorker.store.size).toBe(3);
    await newWorker.lifecycle('activate');
    expect(newWorker.store.has(previousKey)).toBe(false);
    expect(newWorker.store.has('some-other-app-cache')).toBe(true);
    expect(newWorker.store.size).toBe(2);
    newWorker.setOffline(true);
    expect(await (await newWorker.fetch(request('/raiz-e-ritmo/assets/calendar.js', 'same-origin')))?.text()).toBe(secondFiles['assets/calendar.js']);
  });

  it('rejects installation if a required asset is unavailable instead of installing a partial bundle', async () => {
    const files = { ...fixtureFiles };
    delete files['data/events.json'];
    const worker = loadWorker(makeBuild().generate(), { files });
    await expect(worker.lifecycle('install')).rejects.toThrow('Precache failed');
    expect([...worker.store.values()][0].size).toBe(0);
    expect(worker.clientsClaim).not.toHaveBeenCalled();
    expect(worker.skipWaiting).not.toHaveBeenCalled();
  });

  it('only skips the waiting phase after the explicit update message', () => {
    const worker = loadWorker(makeBuild().generate());
    worker.message(undefined);
    worker.message({ type: 'UNKNOWN' });
    expect(worker.skipWaiting).not.toHaveBeenCalled();
    worker.message({ type: 'SKIP_WAITING' });
    expect(worker.skipWaiting).toHaveBeenCalledOnce();
  });
});
