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

export function parseReply(buffer) {
  try {
    return JSON.parse(buffer);
  } catch {
    return null;
  }
}

export function summarize(reply) {
  if (reply.status !== 'success') return `error: ${reply.message ?? 'unknown'}`;
  const result = reply.result ?? {};
  if (result.filepath) return `screenshot ${result.width}x${result.height} ${result.filepath}`;
  if (typeof result.result === 'string') return result.result.trim();
  return JSON.stringify(result).slice(0, 200);
}

export function send(command, { port = DEFAULT_PORT, timeoutMs = 120000 } = {}) {
  return new Promise((fulfil, reject) => {
    let buffer = '';
    const socket = createConnection({ host: '127.0.0.1', port }, () => {
      socket.write(JSON.stringify(command));
    });
    socket.setTimeout(timeoutMs);
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const reply = parseReply(buffer);
      if (reply) {
        socket.end();
        fulfil(reply);
      }
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Blender did not answer within ${timeoutMs} ms`));
    });
    socket.on('error', (error) => reject(new Error(`Blender socket ${port}: ${error.message}`)));
  });
}

async function main() {
  const [scriptPath, screenshotPath] = process.argv.slice(2);
  if (!scriptPath) {
    console.error('Usage: pnpm assets:sketch <sketch.py> [screenshot.png]');
    process.exit(1);
  }
  const port = Number(process.env.BLENDER_PORT ?? DEFAULT_PORT);
  const code = readFileSync(resolve(scriptPath), 'utf8');
  const target = screenshotPath ? resolve(screenshotPath).replace(/\\/g, '/') : null;
  for (const command of sketchCommands(code, target)) {
    const reply = await send(command, { port });
    console.log(`${command.type}: ${summarize(reply)}`);
    if (reply.status !== 'success') process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
