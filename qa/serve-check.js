/* ============================================================
   MTA DevDashboard — serve check
   Spins up a static server, fetches every asset referenced in
   index.html, and fails if anything returns 404.
   Run:  node qa/serve-check.js
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* extract asset urls referenced in index.html */
const refs = [];
const re = /(?:src|href)="((?:css|js)\/[^"]+)"/g;
let m;
while ((m = re.exec(index)) !== null) refs.push(m[1]);

function mime(ext) {
  const map = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.md': 'text/plain' };
  return map[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const p = path.join(root, url);
  try {
    let target = p;
    if (!fs.existsSync(target)) { res.writeHead(404); res.end('404'); return; }
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    res.writeHead(200, { 'Content-Type': mime(path.extname(target)) });
    res.end(fs.readFileSync(target));
  } catch (e) {
    res.writeHead(500); res.end('err');
  }
});

server.listen(0, () => {
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const targets = ['/', ...refs];
  let done = 0, fails = 0;

  function check(url) {
    http.get(base + '/' + url.replace(/^\//, ''), (res) => {
      res.resume();
      if (res.statusCode !== 200) {
        fails++;
        console.log(`  FAIL ${res.statusCode}  /${url}`);
      } else {
        console.log(`  ok  200  /${url}`);
      }
      done++;
      if (done === targets.length) {
        console.log(fails === 0
          ? `\nALL ${targets.length} ASSETS SERVED OK`
          : `\n${fails}/${targets.length} FAILED`);
        server.close();
        process.exit(fails === 0 ? 0 : 1);
      }
    }).on('error', (e) => {
      fails++;
      done++;
      console.log(`  FAIL error fetching /${url}: ${e.message}`);
      if (done === targets.length) { server.close(); process.exit(1); }
    });
  }

  targets.forEach(check);
});