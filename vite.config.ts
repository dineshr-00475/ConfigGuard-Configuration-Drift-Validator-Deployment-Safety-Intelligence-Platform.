import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import net from 'net';
import { defineConfig, Plugin } from 'vite';
import { spawn, ChildProcess } from 'child_process';

function checkPortListening(port: number, host = '127.0.0.1', timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(ok);
      }
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function waitForBackendPort(port = 8088, maxWaitMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await checkPortListening(port)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

function fastapiPlugin(): Plugin {
  let backendProcess: ChildProcess | null = null;
  let isShuttingDown = false;

  const startBackend = () => {
    if (backendProcess || isShuttingDown) return;
    try {
      const pythonPackagesDir = path.resolve(__dirname, '.python_packages');
      const existingPythonPath = process.env.PYTHONPATH || '';
      const pythonPath = existingPythonPath
        ? `${pythonPackagesDir}:${existingPythonPath}`
        : pythonPackagesDir;

      backendProcess = spawn(
        'python3',
        ['-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', '8088'],
        {
          stdio: 'inherit',
          env: {
            ...process.env,
            PYTHONPATH: pythonPath,
          },
        }
      );

      backendProcess.on('exit', () => {
        backendProcess = null;
      });
    } catch (e) {
      console.error('Failed to spawn FastAPI backend process:', e);
    }
  };

  const killBackend = () => {
    isShuttingDown = true;
    if (backendProcess) {
      backendProcess.kill();
      backendProcess = null;
    }
  };

  return {
    name: 'fastapi-backend-launcher',
    configureServer(server) {
      startBackend();

      process.once('exit', killBackend);
      process.once('SIGINT', killBackend);
      process.once('SIGTERM', killBackend);

      server.middlewares.use(async (req, _res, next) => {
        const url = req.url || '';
        if (
          url.startsWith('/api') ||
          url.startsWith('/health') ||
          url.startsWith('/docs') ||
          url.startsWith('/openapi.json') ||
          url.startsWith('/redoc')
        ) {
          const isUp = await checkPortListening(8088);
          if (!isUp) {
            startBackend();
            await waitForBackendPort(8088, 15000);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), fastapiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8088',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://127.0.0.1:8088',
          changeOrigin: true,
        },
        '/docs': {
          target: 'http://127.0.0.1:8088',
          changeOrigin: true,
        },
        '/openapi.json': {
          target: 'http://127.0.0.1:8088',
          changeOrigin: true,
        },
        '/redoc': {
          target: 'http://127.0.0.1:8088',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
