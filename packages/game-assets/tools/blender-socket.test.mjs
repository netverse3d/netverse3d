import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { parseReply, sendBlenderCommand, sketchCommands, summarize } from './blender-socket.mjs';

test('một bản phác thành hai lệnh: chạy mã rồi chụp viewport vào đúng tệp', () => {
  const commands = sketchCommands('import bpy', 'C:/tmp/shot.png');
  assert.deepEqual(commands, [
    { type: 'execute_code', params: { code: 'import bpy' } },
    {
      type: 'get_viewport_screenshot',
      params: { max_size: 1000, filepath: 'C:/tmp/shot.png', format: 'png' },
    },
  ]);
  assert.equal(sketchCommands('import bpy').length, 1);
});

test('trả lời chỉ được đọc khi JSON đã về đủ', () => {
  assert.equal(parseReply('{"status": "succ'), null);
  assert.deepEqual(parseReply('{"status": "success", "result": {}}'), {
    status: 'success',
    result: {},
  });
});

test('tóm tắt trả lời: lỗi, ảnh chụp và kết quả in ra của mã', () => {
  assert.equal(summarize({ status: 'error', message: 'boom' }), 'error: boom');
  assert.equal(
    summarize({ status: 'success', result: { filepath: 'a.png', width: 10, height: 5 } }),
    'screenshot 10x5 a.png',
  );
  assert.equal(
    summarize({ status: 'success', result: { result: 'SKETCHED 20\n' } }),
    'SKETCHED 20',
  );
});

test('gửi lệnh qua socket và nhận trả lời JSON từ máy chủ giả', async () => {
  const server = createServer((socket) => {
    socket.on('data', (chunk) => {
      const command = JSON.parse(chunk.toString('utf8'));
      socket.write(JSON.stringify({ status: 'success', result: { echo: command.type } }));
    });
  });
  await new Promise((fulfil) => server.listen(0, '127.0.0.1', fulfil));
  try {
    const reply = await sendBlenderCommand(
      { type: 'ping', params: {} },
      { port: server.address().port },
    );
    assert.deepEqual(reply, { status: 'success', result: { echo: 'ping' } });
  } finally {
    server.close();
  }
});

test('không có Blender đang mở thì báo lỗi rõ thay vì treo', async () => {
  const server = createServer();
  await new Promise((fulfil) => server.listen(0, '127.0.0.1', fulfil));
  const port = server.address().port;
  await new Promise((fulfil) => server.close(fulfil));
  await assert.rejects(
    sendBlenderCommand({ type: 'ping', params: {} }, { port }),
    /Blender socket/,
  );
});
