import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const callbackRoot = dirname(fileURLToPath(import.meta.url));

function readEnvironment(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

const environment = readEnvironment(join(projectRoot, 'mobile/.env.local'));
const config = {
  url: environment.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: environment.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

if (!config.url || !config.publishableKey) {
  throw new Error('The development Supabase URL/key are missing from mobile/.env.local');
}

const routes = {
  '/': {
    contentType: 'text/html; charset=utf-8',
    body: readFileSync(join(callbackRoot, 'index.html')),
  },
  '/supabase.js': {
    contentType: 'text/javascript; charset=utf-8',
    body: readFileSync(join(projectRoot, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js')),
  },
  '/config.js': {
    contentType: 'text/javascript; charset=utf-8',
    body: `window.DEV_AUTH_CONFIG = ${JSON.stringify(config)};`,
  },
};

const server = createServer((request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  const route = routes[pathname];

  if (!route) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': route.contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(route.body);
});

server.listen(3000, '127.0.0.1', () => {
  console.log('Development auth callback ready at http://localhost:3000');
});

