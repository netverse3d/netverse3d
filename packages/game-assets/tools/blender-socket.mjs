import { readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PORT = 9876;

export function sketchCommands(code, screenshotPath, { maxSize = 1000 } = {}) {
  const commands = [{ type: 'execute_code', params: { code } }];
  if (screenshotPath) {
    commands.push({
      type: 'get_viewport_screenshot',
      params: { max_size: maxSize, filepath: screenshotPath, format: 'png' },
    });
  }
  return commands;
}

export function parseReply(chunks) {
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

export function failed(reply) {
  return reply.status !== 'success' || Boolean(reply.result?.error);
}

export function summarize(reply) {
  if (reply.status !== 'success') return `error: ${reply.message ?? 'unknown'}`;
  const result = reply.result ?? {};
  if (result.error) return `error: ${result.error}`;
  if (result.filepath) return `screenshot ${result.width}x${result.height} ${result.filepath}`;
  if (typeof result.result === 'string') return result.result.trim();
  return JSON.stringify(result).slice(0, 200);
}

export function sendBlenderCommand(command, { port = DEFAULT_PORT, timeoutMs = 120000 } = {}) {
  return new Promise((fulfil, reject) => {
    const chunks = [];
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const socket = createConnection({ host: '127.0.0.1', port }, () => {
      socket.write(JSON.stringify(command));
    });
    socket.setTimeout(timeoutMs);
    socket.on('data', (chunk) => {
      chunks.push(chunk);
      const reply = parseReply(chunks);
      if (reply) {
        finish(fulfil, reply);
        socket.end();
      }
    });
    socket.on('timeout', () => {
      socket.destroy();
      finish(reject, new Error(`Blender did not answer within ${timeoutMs} ms`));
    });
    socket.on('close', () => {
      finish(reject, new Error('Blender closed the connection before answering'));
    });
    socket.on('error', (error) =>
      finish(
        reject,
        new Error(
          error.code === 'ECONNRESET'
            ? 'Blender closed the connection before answering'
            : `Blender socket ${port}: ${error.message}`,
        ),
      ),
    );
  });
}

export function callerPath(path) {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

async function main() {
  const [scriptPath, screenshotPath] = process.argv.slice(2);
  if (!scriptPath) {
    console.error('Usage: pnpm assets:sketch <sketch.py> [screenshot.png]');
    process.exitCode = 1;
    return;
  }
  const port = Number(process.env.BLENDER_PORT ?? DEFAULT_PORT);
  const code = readFileSync(callerPath(scriptPath), 'utf8');
  const target = screenshotPath ? callerPath(screenshotPath).replace(/\\/g, '/') : null;
  for (const command of sketchCommands(code, target)) {
    const reply = await sendBlenderCommand(command, { port });
    console.log(`${command.type}: ${summarize(reply)}`);
    if (failed(reply)) {
      process.exitCode = 1;
      return;
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
