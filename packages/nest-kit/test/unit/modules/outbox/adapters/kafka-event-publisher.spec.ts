import {
  EventProducer,
  KafkaEventPublisher,
  ProducedMessage,
} from '../../../../../src/modules/outbox/adapters/kafka-event-publisher';

const event = {
  id: '11111111-2222-4333-8444-555555555555',
  type: 'user.registered',
  source: 'identity',
  occurredAt: '2026-11-13T08:00:00.000Z',
  version: 1,
  data: { principalId: '7b1d6a52-0c4e-4b53-8f0a-9d2c1e3f4a5b', tenantId: null },
};

class FakeProducer implements EventProducer {
  readonly sent: ProducedMessage[] = [];
  failure: Error | null = null;
  disconnected = false;

  send(message: ProducedMessage): Promise<void> {
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    this.sent.push(message);
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.disconnected = true;
    return Promise.resolve();
  }
}

function subject() {
  const producers: FakeProducer[] = [];
  const connect = jest.fn(() => {
    const producer = new FakeProducer();
    producers.push(producer);
    return Promise.resolve(producer);
  });
  return { publisher: new KafkaEventPublisher(connect), producers, connect };
}

describe('bộ phát sự kiện lên Kafka', () => {
  it('gửi vỏ sự kiện vào topic của service phát, khoá theo phạm vi, kèm mã và loại ở header', async () => {
    const { publisher, producers } = subject();
    await publisher.publish(event);
    expect(producers[0]?.sent).toEqual([
      {
        topic: 'netverse.identity.events.v1',
        key: 'platform',
        value: JSON.stringify(event),
        headers: { 'event-id': event.id, 'event-type': event.type },
      },
    ]);
  });

  it('chỉ nối tới broker một lần cho nhiều sự kiện', async () => {
    const { publisher, connect } = subject();
    await publisher.publish(event);
    await publisher.publish(event);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('không nối tới broker cho tới lúc có sự kiện đầu tiên', () => {
    const { connect } = subject();
    expect(connect).not.toHaveBeenCalled();
  });

  it('broker từ chối thì lỗi được ném ra để outbox thử lại, và lần sau nối lại từ đầu', async () => {
    const { publisher, producers, connect } = subject();
    await publisher.publish(event);
    (producers[0] as FakeProducer).failure = new Error('broker unavailable');
    await expect(publisher.publish(event)).rejects.toThrow('broker unavailable');
    expect(producers[0]?.disconnected).toBe(true);
    await publisher.publish(event);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(producers[1]?.sent).toHaveLength(1);
  });

  it('nối thất bại thì lần sau thử nối lại', async () => {
    const connect = jest
      .fn<Promise<EventProducer>, []>()
      .mockRejectedValueOnce(new Error('no broker'))
      .mockResolvedValue(new FakeProducer());
    const publisher = new KafkaEventPublisher(connect);
    await expect(publisher.publish(event)).rejects.toThrow('no broker');
    await publisher.publish(event);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('ngắt kết nối lúc ứng dụng dừng', async () => {
    const { publisher, producers } = subject();
    await publisher.publish(event);
    await publisher.onModuleDestroy();
    expect(producers[0]?.disconnected).toBe(true);
  });
});
