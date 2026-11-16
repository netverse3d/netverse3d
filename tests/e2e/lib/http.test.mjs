import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { rawRequest, websocketEcho } from './http.mjs';

let server;
let url;
const seen = [];

before(async () => {
  server = http.createServer((request, response) => {
    seen.push(request.url);
    if (request.url === '/plain') {
      response.end('no upgrade here');
      return;
    }
    response.setHeader('x-probe', 'yes');
    response.statusCode = 207;
    response.end(`echo ${request.url}`);
  });
  server.on('upgrade', (request, socket) => {
    if (request.url === '/plain') {
      socket.end(
        'HTTP/1.1 200 OK\r\nContent-Length: 15\r\nConnection: close\r\n\r\nno upgrade here',
      );
      return;
    }
    const accept = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '',
        '',
      ].join('\r\n'),
    );
    socket.once('data', (frame) => {
      const length = frame[1] & 0x7f;
      const mask = frame.subarray(2, 6);
      const payload = Buffer.from(
        frame.subarray(6, 6 + length).map((byte, index) => byte ^ mask[index % 4]),
      );
      socket.write(Buffer.concat([Buffer.from([0x81, payload.length]), payload]));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('rawRequest gửi nguyên đường dẫn có ..', async () => {
  await rawRequest({ url, path: '/a/../b' });
  assert.equal(seen.at(-1), '/a/../b');
});

test('rawRequest gửi nguyên ký tự mã hoá', async () => {
  await rawRequest({ url, path: '/a/%2e%2e/%2Fb' });
  assert.equal(seen.at(-1), '/a/%2e%2e/%2Fb');
});

test('rawRequest trả status, header và body', async () => {
  const response = await rawRequest({ url, path: '/hello', method: 'POST', body: '{}' });
  assert.equal(response.status, 207);
  assert.equal(response.headers['x-probe'], 'yes');
  assert.equal(response.body, 'echo /hello');
});

test('websocketEcho nâng cấp kết nối và đọc lại khung echo', async () => {
  const result = await websocketEcho({ url, path: '/echo', message: 'ping-gateway' });
  assert.equal(result.status, 101);
  assert.equal(result.opcode, 1);
  assert.equal(result.text, 'ping-gateway');
});

test('websocketEcho báo lỗi khi máy chủ không nâng cấp kết nối', async () => {
  await assert.rejects(
    websocketEcho({ url, path: '/plain', message: 'x' }),
    /answered 200 instead of 101/,
  );
});
