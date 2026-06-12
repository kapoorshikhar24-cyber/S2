// Local dev server — zero dependencies (Node built-ins only)
// Usage: npm run dev  OR  node server.js
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { URL } = require('url');

// ── Load .env ──────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eq = trimmed.indexOf('=');
        if (eq === -1) return;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        process.env[key] = val; // Force overwrite for local dev
    });
    console.log('✅ Loaded .env (Variables Overridden)');
}

// ── Config ─────────────────────────────────────────────────────────────────
const PORT   = process.env.PORT || 3000;
const ROOT   = __dirname;
const PUBLIC = path.join(ROOT, 'public');

const MIME = {
    '.html': 'text/html',
    '.css' : 'text/css',
    '.js'  : 'application/javascript',
    '.json': 'application/json',
    '.png' : 'image/png',
    '.jpg' : 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif' : 'image/gif',
    '.svg' : 'image/svg+xml',
    '.ico' : 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

// ── API route map ──────────────────────────────────────────────────────────
const sfHandler = require('./api/sf');
const API_ROUTES = {
    '/api/auth'         : require('./api/auth'),
    '/api/users'        : require('./api/users'),
    '/api/projects'     : require('./api/projects'),
    '/api/entries'      : require('./api/entries'),
    '/api/notifications': require('./api/notifications'),
    '/api/settings'     : require('./api/settings'),
    '/api/picklists'    : require('./api/picklists'),
    '/api/moms'         : require('./api/moms'),
    // Salesforce Automator routes
    '/api/sf-auth'      : sfHandler,
    '/api/sf-run'       : sfHandler,
    '/api/sf-fields'    : sfHandler,
    '/api/sf-objects'   : sfHandler,
    '/api/sf-history'   : sfHandler,
};

// ── Vercel-compatible req/res shim ─────────────────────────────────────────
function buildReq(req, body, parsedUrl) {
    req.body  = body;
    req.query = Object.fromEntries(parsedUrl.searchParams);
    return req;
}

function buildRes(res) {
    let statusCode = 200;
    const headers = {
        'Access-Control-Allow-Origin' : '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    };
    return {
        status  (code)   { statusCode = code; return this; },
        setHeader(k, v)  { headers[k] = v;    return this; },
        end     ()       { res.writeHead(statusCode, headers); res.end(); },
        json    (data)   {
            headers['Content-Type'] = 'application/json';
            res.writeHead(statusCode, headers);
            res.end(JSON.stringify(data));
        },
    };
}

// ── Static file resolver ───────────────────────────────────────────────────
// Priority: public/<path>  →  <root>/<path>  →  public/index.html (SPA fallback)
function resolveStaticFile(pathname) {
    // 1. Try file in public/ directory
    const filePath = path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname);
    
    // Never serve files from api/ directory
    if (filePath.startsWith(path.join(ROOT, 'api'))) return path.join(PUBLIC, 'index.html');
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return filePath;
    }
    
    // 2. SPA Fallback: index.html
    return path.join(PUBLIC, 'index.html');
}

// ── Request handler ────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname  = parsedUrl.pathname;

    // API routes
    const apiHandler = API_ROUTES[pathname];
    if (apiHandler) {
        let rawBody = '';
        req.on('data', chunk => rawBody += chunk);
        req.on('end', async () => {
            let body = {};
            if (rawBody) { try { body = JSON.parse(rawBody); } catch {} }
            const shimRes = buildRes(res);
            try {
                await apiHandler(buildReq(req, body, parsedUrl), shimRes);
            } catch (err) {
                console.error(`[API] ${pathname}:`, err.message);
                shimRes.status(500).json({ message: 'Internal Server Error' });
            }
        });
        return;
    }

    // Static files
    const filePath    = resolveStaticFile(pathname);
    const ext         = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('');
    console.log('🚀 UAT Dashboard → http://localhost:' + PORT);
    console.log('👤 Login: admin / ' + (process.env.ADMIN_PASSWORD || 'admin123'));
    console.log('🗄️  MongoDB: ' + (process.env.MONGODB_URI ? '✅ configured' : '❌ MONGODB_URI missing in .env'));
    console.log('');
});
