// Starts the Express API (port 4000) and the Next.js dashboard (port 3000) together.
// Usage: npm run dev
import { spawn } from 'node:child_process';

const apiPort = process.env.API_PORT || '4000';
const webPort = process.env.PORT || '3000';

const processes = [
  // The API gets its own port explicitly so an inherited PORT never makes it collide with Next.js.
  { name: 'api', cmd: 'node', args: ['--watch', 'backend/server.js'], env: { API_PORT: apiPort } },
  {
    name: 'web',
    cmd: 'npx',
    args: ['next', 'dev', '-p', webPort],
    env: { BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${apiPort}` },
  },
];

const children = processes.map(({ name, cmd, args, env }) => {
  const child = spawn(cmd, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  const prefix = `[${name}] `;
  const pipe = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n')) if (line.trim()) out.write(prefix + line + '\n');
    });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${prefix}exited with code ${code}`);
    shutdown(code ?? 0);
  });
  return child;
});

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
