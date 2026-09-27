const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const PORT = Number(process.env.PORT || 8001);
const sessions = new Map();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.avif': 'image/avif', '.json': 'application/json; charset=utf-8' };

function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, digest: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function readDb() {
  if (!fs.existsSync(DATA_FILE)) {
    const admin = hash(process.env.ADMIN_PASSWORD || 'admin123');
    const db = { users: [{ id: crypto.randomUUID(), username: process.env.ADMIN_USERNAME || 'admin', role: 'admin', ...admin, durationMinutes: 0, createdAt: new Date().toISOString() }], layouts: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    return db;
  }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { users: [], layouts: {} }; }
}
let db = readDb();
function save() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
function safeUser(u) {
  const active = Boolean(u.activationAt && Date.now() < new Date(u.activationAt).getTime() + u.durationMinutes * 60000);
  return { id: u.id, username: u.username, role: u.role, durationMinutes: u.durationMinutes, isActive: u.role === 'admin' || active, expiresAt: u.activationAt ? new Date(new Date(u.activationAt).getTime() + u.durationMinutes * 60000).toISOString() : null, createdAt: u.createdAt };
}
function send(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = ''; req.on('data', c => { raw += c; if (raw.length > 1e6) reject(new Error('Request too large')); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } });
  });
}
function sessionUser(req) {
  const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('sid='))?.slice(4);
  const id = sessions.get(token); return db.users.find(u => u.id === id);
}
function auth(req, res, admin = false) {
  const user = sessionUser(req);
  if (!user) { send(res, 401, { error: 'Please log in' }); return null; }
  if (admin && user.role !== 'admin') { send(res, 403, { error: 'Admin access required' }); return null; }
  return user;
}
async function api(req, res, url) {
  const p = url.pathname;
  if (p === '/api/auth/login' && req.method === 'POST') {
    let input; try { input = await body(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const u = db.users.find(x => x.username.toLowerCase() === String(input.username || '').trim().toLowerCase());
    const check = u && hash(input.password || '', u.salt).digest === u.digest;
    if (!check) return send(res, 401, { error: 'Invalid username or password' });
    if (u.role !== 'admin' && u.activationAt && Date.now() >= new Date(u.activationAt).getTime() + u.durationMinutes * 60000) return send(res, 403, { error: 'This account has expired' });
    if (u.role !== 'admin' && !u.activationAt) { u.activationAt = new Date().toISOString(); save(); }
    const sid = crypto.randomBytes(32).toString('hex'); sessions.set(sid, u.id);
    return send(res, 200, { success: true, user: safeUser(u) }, { 'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Lax; Path=/` });
  }
  if (p === '/api/auth/status' && req.method === 'GET') {
    const u = sessionUser(req); return send(res, 200, u ? { authenticated: true, user: safeUser(u) } : { authenticated: false });
  }
  if (p === '/api/auth/logout' && req.method === 'POST') {
    const sid = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('sid='))?.slice(4); sessions.delete(sid);
    return send(res, 200, { success: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
  }
  if (p === '/api/users' && req.method === 'GET') {
    if (!auth(req, res, true)) return; return send(res, 200, { users: db.users.map(safeUser) });
  }
  if (p === '/api/users' && req.method === 'POST') {
    if (!auth(req, res, true)) return;
    let input; try { input = await body(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const username = String(input.username || '').trim(); const password = String(input.password || ''); const duration = Number(input.duration);
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) return send(res, 400, { error: 'Username must be 3–32 letters, numbers, dots, dashes, or underscores' });
    if (password.length < 6 || !Number.isFinite(duration) || duration <= 0) return send(res, 400, { error: 'Enter a password of at least 6 characters and a valid duration' });
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return send(res, 409, { error: 'Username already exists' });
    db.users.push({ id: crypto.randomUUID(), username, role: 'customer', ...hash(password), durationMinutes: duration, activationAt: null, createdAt: new Date().toISOString() }); save();
    return send(res, 201, { success: true });
  }
  if (p === '/api/users/expired' && req.method === 'DELETE') {
    if (!auth(req, res, true)) return;
    const before = db.users.length; db.users = db.users.filter(u => u.role === 'admin' || !u.activationAt || Date.now() < new Date(u.activationAt).getTime() + u.durationMinutes * 60000); save();
    return send(res, 200, { success: true, message: `Removed ${before - db.users.length} expired users` });
  }
  if (p.startsWith('/api/users/') && req.method === 'PATCH') {
    if (!auth(req, res, true)) return;
    let input; try { input = await body(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const u = db.users.find(x => x.id === p.split('/')[3]); if (!u || u.role === 'admin') return send(res, 404, { error: 'Customer not found' });
    if (p.endsWith('/extend')) { const days = Number(input.days); if (!Number.isFinite(days) || !days) return send(res, 400, { error: 'Invalid day count' }); u.durationMinutes = Math.max(1, u.durationMinutes + days * 1440); }
    else if (input.password && input.password.length >= 6) Object.assign(u, hash(input.password));
    else return send(res, 400, { error: 'Password must be at least 6 characters' });
    save(); return send(res, 200, { success: true });
  }
  if (p.startsWith('/api/users/') && req.method === 'DELETE') {
    if (!auth(req, res, true)) return;
    const id = p.split('/')[3]; const before = db.users.length; db.users = db.users.filter(u => u.id !== id || u.role === 'admin');
    if (before === db.users.length) return send(res, 404, { error: 'Customer not found' }); save(); return send(res, 200, { success: true });
  }
  if (p === '/api/layout' && req.method === 'GET') { const key = url.searchParams.get('key'); return send(res, 200, { ok: true, style: db.layouts[key] || null }); }
  if (p === '/api/layout' && req.method === 'POST') {
    let input; try { input = await body(req); } catch (e) { return send(res, 400, { error: e.message }); }
    if (!input.key || typeof input.style !== 'object') return send(res, 400, { error: 'Invalid layout' }); db.layouts[input.key] = input.style; save(); return send(res, 200, { ok: true });
  }
  if (p.startsWith('/api/tiktok-live/')) return send(res, 200, p.endsWith('/status') ? { connected: false } : { error: 'TikTok Live integration is not configured' });
  return send(res, 404, { error: 'API route not found' });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/portal.html';
  const filename = path.resolve(ROOT, `.${pathname}`);
  if (!filename.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filename, (err, content) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' }); res.end(content);
  });
});
server.listen(PORT, '0.0.0.0', () => console.log(`App running at http://localhost:${PORT}/portal.html`));
