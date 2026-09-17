const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '../dist');
const outDir = path.resolve(__dirname, '../dist-standalone');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist. Please run `npm run build` first.');
  process.exit(1);
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      const relPath = '/' + path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push({ fullPath, relPath });
    }
  }
  return files;
}

const allFiles = getAllFiles(distDir);
console.log(`Found ${allFiles.length} assets in ${distDir}`);

const assetMap = {};

for (const { fullPath, relPath } of allFiles) {
  const buffer = fs.readFileSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  assetMap[relPath] = {
    base64: buffer.toString('base64'),
    mime
  };
  // Also register index.html for root path
  if (relPath === '/index.html') {
    assetMap['/'] = assetMap[relPath];
  }
}

const runnerTemplate = `// Self-contained standalone runner for Synthetix Mock Data Generator
const http = require('http');
const { exec } = require('child_process');

const ASSETS = ${JSON.stringify(assetMap)};

function getFreePort(startingPort = 3000) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(startingPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(getFreePort(startingPort + 1));
    });
  });
}

function openBrowser(url) {
  const plat = process.platform;
  let cmd = '';
  if (plat === 'win32') {
    cmd = 'start "" "' + url + '"';
  } else if (plat === 'darwin') {
    cmd = 'open "' + url + '"';
  } else {
    cmd = 'xdg-open "' + url + '"';
  }
  try {
    exec(cmd);
  } catch (err) {
    // Ignore error if browser cannot be launched automatically
  }
}

async function start() {
  const port = await getFreePort(process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '') reqPath = '/';

    let asset = ASSETS[reqPath];
    // Fallback to index.html for client-side routing
    if (!asset && !path.extname(reqPath)) {
      asset = ASSETS['/index.html'] || ASSETS['/'];
    }

    if (!asset) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const buf = Buffer.from(asset.base64, 'base64');
    res.writeHead(200, {
      'Content-Type': asset.mime,
      'Content-Length': buf.length,
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });

  server.listen(port, '127.0.0.1', () => {
    const url = 'http://localhost:' + port;
    console.log('');
    console.log('===============================================================');
    console.log('  Synthetix - Standalone High-Speed Mock Data Generator');
    console.log('===============================================================');
    console.log('  App URL : ' + url);
    console.log('  Status  : Running offline (Single Executable Mode)');
    console.log('  Press Ctrl+C in this window to stop.');
    console.log('===============================================================');
    console.log('');
    openBrowser(url);
  });
}

start().catch((err) => {
  console.error('Fatal error starting Synthetix:', err);
  process.exit(1);
});
`;

fs.writeFileSync(path.join(outDir, 'server.cjs'), runnerTemplate, 'utf8');
console.log(`Successfully generated standalone server script at: ${path.join(outDir, 'server.cjs')}`);
