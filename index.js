/**
 * Host half of the ComfyUI monitor bundle.
 *
 * The browser cannot read a ComfyUI server directly (no CORS headers), so the Host
 * proxies a small allowlist of ComfyUI endpoints under `/comfyui-proxy/<serverId>/…`.
 * Only servers from this plugin's settings (plus ports found by the optional local
 * discovery) are reachable, so the route is not an open relay. Every request first
 * passes the Harness `connection` fence (Host/Origin check + browser login cookie).
 *
 * Servers are edited in the plugin page (Plugins → ComfyUI Monitor) and persisted by
 * the Host in `<DSH home>/comfyui-panel.json` (mode 0600: it may hold an Authorization
 * header for a remote server). Servers declared in the bundle patch `config` stay
 * listed too, read-only.
 */
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const name = 'comfyui-panel';
export const inject = ['webServer', 'connection'];

const BASE = '/comfyui-proxy';
const PROBE_TIMEOUT_MS = 1500;
const TEST_TIMEOUT_MS = 5000;
const FORWARD_TIMEOUT_MS = 15000;
const LIST_TTL_MS = 4000;
const MAX_BODY = 64 * 1024;
const DEFAULT_PORTS = [8188, 8189, 8190, 8191, 8192, 8193, 8194, 8195];
const STATE_FILE = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'comfyui-panel.json');

const GET_ALLOWED = [
  /^system_stats$/,
  /^queue$/,
  /^history$/,
  /^history\/[\w-]+$/,
  /^prompt$/,
  /^view$/,
  /^api\/jobs$/,
  /^api\/jobs\/[\w-]+$/,
];
const POST_ALLOWED = [/^queue$/, /^interrupt$/];

const slug = (value) =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'server';

/** Accept `host:port`, `host` or a full URL; return a clean http(s) origin + path. */
function originOf(raw) {
  let text = String(raw ?? '').trim();
  if (!text) throw new Error('empty url');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `http://${text}`;
  const url = new URL(text);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('only http(s) urls');
  if (url.username || url.password) throw new Error('put credentials in the Authorization field, not the url');
  return url.origin + url.pathname.replace(/\/+$/, '');
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const raw = await readBody(req);
  return raw.length ? JSON.parse(raw.toString('utf8')) : {};
}

/** Ask one URL for /system_stats; resolves to a summary only for a real ComfyUI. */
async function probe(server, timeout = PROBE_TIMEOUT_MS) {
  try {
    const response = await fetch(`${server.url}/system_stats`, {
      headers: server.headers,
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) return { online: false, error: `HTTP ${response.status}` };
    const stats = await response.json().catch(() => undefined);
    if (!stats || typeof stats !== 'object' || !stats.system || !Array.isArray(stats.devices)) {
      return { online: false, error: 'not a ComfyUI server' };
    }
    const device = stats.devices[0];
    return {
      online: true,
      version: stats.system.comfyui_version,
      device: device ? device.name : undefined,
    };
  } catch (error) {
    const cause = error?.cause?.code || error?.name;
    return { online: false, error: cause === 'TimeoutError' ? 'timeout' : String(cause || error?.message || error) };
  }
}

function readState() {
  try {
    const data = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(tmp, STATE_FILE);
  try {
    chmodSync(STATE_FILE, 0o600);
  } catch {
    /* best effort (non-POSIX filesystems) */
  }
}

/** Validate one ports field: array of ints, or a "8188-8195, 8200" string. */
function parsePorts(value) {
  const out = [];
  const parts = Array.isArray(value) ? value : String(value ?? '').split(/[\s,;]+/);
  for (const part of parts) {
    if (part === '' || part === undefined || part === null) continue;
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(String(part));
    const [from, to] = range ? [Number(range[1]), Number(range[2])] : [Number(part), Number(part)];
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 65535 || to < from || to - from > 64) {
      throw new Error(`invalid port "${part}"`);
    }
    for (let p = from; p <= to; p += 1) if (!out.includes(p)) out.push(p);
  }
  return out;
}

export function apply(ctx, config = {}) {
  const connection = Reflect.get(ctx, 'connection');

  /** Unique-id server list from raw entries; `source` is 'config' or 'saved'. */
  function buildServers(entries, source, used) {
    const list = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || typeof entry.url !== 'string') continue;
      let url;
      try {
        url = originOf(entry.url);
      } catch {
        ctx.logger?.warn?.(`comfyui-panel: ignoring invalid server url ${entry.url}`);
        continue;
      }
      const base = slug(entry.id ?? new URL(url).host);
      let id = base;
      for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
      used.add(id);
      const headers = entry.headers && typeof entry.headers === 'object' ? { ...entry.headers } : {};
      if (typeof entry.auth === 'string' && entry.auth) headers.Authorization = entry.auth;
      list.push({
        id,
        name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : new URL(url).host,
        url,
        headers,
        auth: typeof entry.auth === 'string' && entry.auth ? entry.auth : undefined,
        source,
      });
    }
    return list;
  }

  // Resolved settings; rebuilt after every save.
  let configured = [];
  let saved = [];
  let discover;
  let cache = { at: 0, servers: [], pending: undefined };

  function load() {
    const state = readState();
    const used = new Set();
    configured = buildServers(config.servers, 'config', used);
    saved = buildServers(state.servers, 'saved', used);
    const raw = state.discover ?? (config.discover === false ? { enabled: false } : config.discover ?? {});
    let ports = DEFAULT_PORTS;
    try {
      const parsed = parsePorts(raw.ports);
      if (parsed.length) ports = parsed;
    } catch {
      /* keep defaults */
    }
    discover = {
      enabled: raw.enabled !== false,
      host: typeof raw.host === 'string' && raw.host.trim() ? raw.host.trim() : '127.0.0.1',
      ports,
    };
    cache = { at: 0, servers: [], pending: undefined };
  }
  load();

  /** Configured + saved servers (always listed) + discovered ones that answer right now. */
  async function refresh() {
    const candidates = [...configured, ...saved];
    if (discover.enabled) {
      for (const port of discover.ports) {
        const url = `http://${discover.host}:${port}`;
        if (candidates.some((c) => c.url === url)) continue;
        candidates.push({
          id: slug(`${discover.host}-${port}`),
          name: `${discover.host}:${port}`,
          url,
          headers: {},
          source: 'discovered',
        });
      }
    }
    const probed = await Promise.all(candidates.map(async (c) => ({ ...c, ...(await probe(c)) })));
    const seen = new Set();
    return probed.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return s.source !== 'discovered' || s.online;
    });
  }

  async function servers(force = false) {
    if (!force && Date.now() - cache.at < LIST_TTL_MS) return cache.servers;
    cache.pending ??= refresh()
      .then((list) => {
        cache = { at: Date.now(), servers: list, pending: undefined };
        return list;
      })
      .catch((error) => {
        cache.pending = undefined;
        throw error;
      });
    return cache.pending;
  }

  const publicView = (s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    online: Boolean(s.online),
    version: s.version,
    device: s.device,
    error: s.online ? undefined : s.error,
    source: s.source,
  });

  const settingsView = () => ({
    servers: saved.map((s) => ({ id: s.id, name: s.name, url: s.url, hasAuth: Boolean(s.auth) })),
    configServers: configured.map((s) => ({ id: s.id, name: s.name, url: s.url })),
    discover,
    defaultPorts: DEFAULT_PORTS,
    file: STATE_FILE,
  });

  /** Validate + persist the settings posted by the plugin page. */
  function saveSettings(input) {
    if (!input || typeof input !== 'object') throw new Error('invalid body');
    const previous = new Map(saved.map((s) => [s.id, s]));
    const next = [];
    for (const entry of Array.isArray(input.servers) ? input.servers : []) {
      if (!entry || typeof entry !== 'object') continue;
      const url = originOf(entry.url);
      const old = typeof entry.id === 'string' ? previous.get(entry.id) : undefined;
      let auth = old?.auth;
      if (typeof entry.auth === 'string') auth = entry.auth.trim() || undefined;
      next.push({
        id: typeof entry.id === 'string' && entry.id ? entry.id : undefined,
        name: typeof entry.name === 'string' ? entry.name.trim().slice(0, 80) : '',
        url,
        auth,
      });
    }
    if (next.length > 32) throw new Error('too many servers');
    const rawDiscover = input.discover && typeof input.discover === 'object' ? input.discover : {};
    const host = typeof rawDiscover.host === 'string' && rawDiscover.host.trim() ? rawDiscover.host.trim() : '127.0.0.1';
    if (!/^[\w.:[\]-]+$/.test(host)) throw new Error('invalid discovery host');
    const ports = parsePorts(rawDiscover.ports);
    writeState({
      version: 1,
      servers: next.map((s) => ({ ...s, id: s.id ?? slug(new URL(s.url).host) })),
      discover: { enabled: rawDiscover.enabled !== false, host, ports: ports.length ? ports : DEFAULT_PORTS },
    });
    load();
  }

  async function forward(req, res, server, sub, search) {
    const method = req.method;
    const init = {
      method,
      headers: { ...server.headers },
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    };
    if (method === 'POST') {
      const body = await readBody(req);
      init.body = body.length ? body : '{}';
      init.headers['content-type'] = 'application/json';
    }
    let upstream;
    try {
      upstream = await fetch(`${server.url}/${sub}${search}`, init);
    } catch (error) {
      sendJson(res, 502, { error: 'upstream-unreachable', message: String(error?.message ?? error) });
      return;
    }
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = upstream.status;
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('content-type', type);
    res.setHeader('cache-control', sub === 'view' ? 'private, max-age=600' : 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.end(payload);
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: BASE,
        handler: async (req, res) => {
          const rejection = connection.requestRejection(req);
          if (rejection !== undefined) {
            res.statusCode = rejection;
            res.end();
            return;
          }
          try {
            const url = new URL(String(req.url), 'http://localhost');
            const rest = url.pathname.slice(BASE.length).replace(/^\/+/, '');

            if (rest === '_servers') {
              if (req.method !== 'GET') return sendJson(res, 405, { error: 'method-not-allowed' });
              const list = await servers(url.searchParams.has('fresh'));
              return sendJson(res, 200, { servers: list.map(publicView) });
            }

            if (rest === '_config') {
              if (req.method === 'GET') return sendJson(res, 200, settingsView());
              if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
              try {
                saveSettings(await readJson(req));
              } catch (error) {
                return sendJson(res, 400, { error: 'invalid-settings', message: String(error?.message ?? error) });
              }
              return sendJson(res, 200, settingsView());
            }

            if (rest === '_probe') {
              if (req.method !== 'POST') return sendJson(res, 405, { error: 'method-not-allowed' });
              let body;
              let target;
              try {
                body = await readJson(req);
                const old = [...saved, ...configured].find((s) => s.id === body.id);
                const auth = typeof body.auth === 'string' && body.auth.trim() ? body.auth.trim() : old?.auth;
                target = { url: originOf(body.url), headers: auth ? { Authorization: auth } : {} };
              } catch (error) {
                return sendJson(res, 400, { error: 'invalid-probe', message: String(error?.message ?? error) });
              }
              return sendJson(res, 200, { url: target.url, ...(await probe(target, TEST_TIMEOUT_MS)) });
            }

            const slash = rest.indexOf('/');
            const id = slash < 0 ? rest : rest.slice(0, slash);
            const sub = slash < 0 ? '' : rest.slice(slash + 1);
            const allowed = req.method === 'GET' ? GET_ALLOWED : req.method === 'POST' ? POST_ALLOWED : [];
            if (!allowed.some((pattern) => pattern.test(sub))) {
              return sendJson(res, 404, { error: 'not-allowed', message: `${req.method} /${sub}` });
            }
            const server = (await servers()).find((s) => s.id === id);
            if (!server) return sendJson(res, 404, { error: 'unknown-server', message: id });
            await forward(req, res, server, sub, url.search);
          } catch (error) {
            if (!res.headersSent) sendJson(res, 500, { error: 'internal', message: String(error?.message ?? error) });
          }
        },
      }),
    `comfyui-panel: ${BASE}`,
  );
}
