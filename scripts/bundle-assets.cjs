const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '../dist');
const outputFile = path.resolve(__dirname, '../server.js');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory not found. Please run "npm run build" first.');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

function getAllFiles(dir, base = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const relPath = path.join(base, file).replace(/\\/g, '/');
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, relPath));
    } else {
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

const files = getAllFiles(distDir);
const assetMap = {};

for (const { fullPath, relPath } of files) {
  const content = fs.readFileSync(fullPath);
  const ext = path.extname(relPath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const isBinary = mime.startsWith('image/') || mime.startsWith('font/') || mime.startsWith('application/wasm');

  assetMap['/' + relPath] = {
    mime,
    content: isBinary ? content.toString('base64') : content.toString('utf8'),
    isBase64: isBinary,
  };
}

// Add root alias
if (assetMap['/index.html']) {
  assetMap['/'] = assetMap['/index.html'];
}

console.log(`Bundled ${Object.keys(assetMap).length} static assets from dist/ into standalone server.`);

const serverCode = `// Standalone embedded loopback server for VAMPIO Single Executable (Node SEA)
const http = require('http');
const { exec } = require('child_process');

const ASSETS = ${JSON.stringify(assetMap, null, 2)};

function getAsset(pathname) {
  if (ASSETS[pathname]) return ASSETS[pathname];
  // SPA Fallback: serve index.html for non-asset routes
  if (ASSETS['/index.html']) return ASSETS['/index.html'];
  return null;
}

function openBrowser(url) {
  const startCmd = process.platform === 'win32'
    ? 'start "" "' + url + '"'
    : process.platform === 'darwin'
    ? 'open "' + url + '"'
    : 'xdg-open "' + url + '"';

  exec(startCmd, (err) => {
    if (err) {
      console.log('Open your browser and navigate to: ' + url);
    }
  });
}

function startServer(initialPort) {
  const port = initialPort;
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://' + req.headers.host);
    const pathname = decodeURIComponent(parsedUrl.pathname);
    const asset = getAsset(pathname);

    if (!asset) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': asset.mime,
      'Cache-Control': 'no-cache',
    });

    if (asset.isBase64) {
      res.end(Buffer.from(asset.content, 'base64'));
    } else {
      res.end(asset.content);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('Port ' + port + ' is in use, trying ' + (port + 1) + '...');
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + port;
    console.log('==================================================');
    console.log('  VAMPIO - Synthetic Data Architecture Studio');
    console.log('  Running offline at: ' + url);
    console.log('  Press Ctrl+C to terminate.');
    console.log('==================================================');
    openBrowser(url);
  });
}

startServer(3000);
`;

fs.writeFileSync(outputFile, serverCode, 'utf8');
console.log(`Successfully generated standalone server: ${outputFile}`);
