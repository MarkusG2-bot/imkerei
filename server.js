// Kleiner lokaler Webserver für die Imkerei-App (keine Abhängigkeiten).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5180;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const datei = path.join(__dirname, rel === '/' ? 'index.html' : rel);
  if (!datei.startsWith(__dirname)) { res.writeHead(403).end(); return; }
  fs.readFile(datei, (err, inhalt) => {
    if (err) { res.writeHead(404).end('Nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(datei)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(inhalt);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Imkerei läuft: http://localhost:${PORT}`));
