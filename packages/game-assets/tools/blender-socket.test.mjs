import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  callerPath,
  failed,
  parseReply,
  sendBlenderCommand,
  sketchCommands,
  summarize,
} from './blender-socket.mjs';

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

test('trả lời chỉ được đọc khi JSON đã về đủ, kể cả khi chữ có dấu bị cắt giữa hai mảnh', () => {
  assert.equal(parseReply([Buffer.from('{"status": "succ')]), null);
  const whole = Buffer.from('{"status": "success", "result": {"result": "mặt tiền"}}');
  const chunks = [whole.subarray(0, 44), whole.subarray(44)];
  assert.deepEqual(parseReply(chunks), { status: 'success', result: { result: 'mặt tiền' } });
});

test('tóm tắt trả lời: lỗi, lỗi nằm trong kết quả, ảnh chụp và kết quả in ra của mã', () => {
  assert.equal(summarize({ status: 'error', message: 'boom' }), 'error: boom');
  assert.equal(
    summarize({ status: 'success', result: { error: 'No 3D viewport found' } }),
    'error: No 3D viewport found',
  );
  assert.equal(
    summarize({ status: 'success', result: { filepath: 'a.png', width: 10, height: 5 } }),
    'screenshot 10x5 a.png',
  );
  assert.equal(
    summarize({ status: 'success', result: { result: 'SKETCHED 20\n' } }),
    'SKETCHED 20',
  );
  assert.equal(failed({ status: 'success', result: { error: 'x' } }), true);
  assert.equal(failed({ status: 'error' }), true);
  assert.equal(failed({ status: 'success', result: {} }), false);
});

test('đường dẫn tương đối tính từ nơi người dùng gõ lệnh, không phải thư mục gói', () => {
  const previous = process.env.INIT_CWD;
  process.env.INIT_CWD = 'C:/work/here';
  try {
    assert.equal(callerPath('sketch.py'), resolve('C:/work/here', 'sketch.py'));
    assert.equal(callerPath('C:/elsewhere/sketch.py'), resolve('C:/elsewhere/sketch.py'));
  } finally {
    if (previous === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = previous;
  }
});

async function listen(server) {
  await new Promise((fulfil) => server.listen(0, '127.0.0.1', fulfil));
  return server.address().port;
}

test('gửi lệnh qua socket và nhận trả lời JSON về theo nhiều mảnh từ máy chủ giả', async () => {
  const server = createServer((socket) => {
    socket.on('data', (chunk) => {
      const command = JSON.parse(chunk.toString('utf8'));
      const reply = JSON.stringify({ status: 'success', result: { echo: command.type } });
      socket.write(reply.slice(0, 12));
      setTimeout(() => socket.write(reply.slice(12)), 20);
    });
  });
  const port = await listen(server);
  try {
    const reply = await sendBlenderCommand({ type: 'ping', params: {} }, { port });
    assert.deepEqual(reply, { status: 'success', result: { echo: 'ping' } });
  } finally {
    await new Promise((fulfil) => server.close(fulfil));
  }
});

test('Blender đóng kết nối mà chưa trả lời thì báo lỗi ngay, không đợi hết thời gian chờ', async () => {
  const server = createServer((socket) => socket.destroy());
  const port = await listen(server);
  try {
    await assert.rejects(
      sendBlenderCommand({ type: 'ping', params: {} }, { port, timeoutMs: 5000 }),
      /closed the connection/,
    );
  } finally {
    await new Promise((fulfil) => server.close(fulfil));
  }
});

test('không có Blender đang mở thì báo lỗi rõ thay vì treo', async () => {
  const server = createServer();
  const port = await listen(server);
  await new Promise((fulfil) => server.close(fulfil));
  await assert.rejects(
    sendBlenderCommand({ type: 'ping', params: {} }, { port }),
    /Blender socket/,
  );
});
