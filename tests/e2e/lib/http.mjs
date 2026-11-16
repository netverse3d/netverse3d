import { randomBytes } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

const REQUEST_TIMEOUT_MS = 10_000;

export function rawRequest({ url, method = 'GET', path, headers = {}, body }) {
  const target = new URL(url);
  const client = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(
      {
        host: target.hostname,
        port: target.port,
        method,
        path,
        headers:
          body === undefined ? headers : { ...headers, 'content-length': Buffer.byteLength(body) },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('timeout', () => request.destroy(new Error(`${method} ${path} timed out`)));
    request.on('error', reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

function maskedTextFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  if (payload.length > 125) throw new Error('probe frames must be shorter than 126 bytes');
  const mask = randomBytes(4);
  const masked = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
  return Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]);
}

function readTextFrame(buffer) {
  if (buffer.length < 2) return null;
  const length = buffer[1] & 0x7f;
  if (length > 125) throw new Error('probe frames must be shorter than 126 bytes');
  if (buffer.length < 2 + length) return null;
  return { opcode: buffer[0] & 0x0f, text: buffer.subarray(2, 2 + length).toString('utf8') };
}

export function websocketEcho({ url, path, message, timeoutMs = 5000 }) {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: target.hostname,
      port: target.port,
      path,
      headers: {
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-version': '13',
        'sec-websocket-key': randomBytes(16).toString('base64'),
      },
    });
    const timer = setTimeout(() => {
      request.destroy();
      reject(new Error(`no websocket echo from ${path} within ${timeoutMs} ms`));
    }, timeoutMs);
    request.on('response', (response) => {
      clearTimeout(timer);
      response.resume();
      reject(new Error(`${path} answered ${response.statusCode} instead of 101`));
    });
    request.on('upgrade', (response, socket, head) => {
      let received = head;
      const finish = (result) => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ status: response.statusCode, ...result });
      };
      socket.on('data', (chunk) => {
        received = Buffer.concat([received, chunk]);
        const frame = readTextFrame(received);
        if (frame) finish(frame);
      });
      socket.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      socket.write(maskedTextFrame(message));
    });
    request.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    request.end();
  });
}
