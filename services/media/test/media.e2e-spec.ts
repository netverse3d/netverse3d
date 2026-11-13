import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  HardDeleteReaper,
  PendingReaper,
  TemporaryReaper,
} from '../src/modules/media/jobs/media-reapers';
import { EventEnvelope } from '@netverse/nest-kit';
import { EventPublisher } from '@netverse/nest-kit';
import { OutboxRelayJob } from '@netverse/nest-kit';
import { createTestApp, TestApp } from './support/test-app';

const PNG = 'image/png';

const permanentUpload = (overrides: Record<string, unknown> = {}) => ({
  contentType: PNG,
  declaredSizeBytes: 100,
  ownerType: 'avatar',
  ownerId: 'user-1',
  originalFilename: 'photo.png',
  ...overrides,
});

describe('media', () => {
  let subject: TestApp;
  let prisma: PrismaService;
  let tenant: string;
  const http = () => request(subject.app.getHttpServer());

  beforeAll(async () => {
    subject = await createTestApp();
    prisma = subject.app.get(PrismaService);
  });

  afterAll(() => subject.close());

  beforeEach(() => {
    tenant = `tenant-${randomUUID()}`;
    subject.storage.unavailable = false;
  });

  const token = (name: string, roles: string[] = [], tenantId = tenant) =>
    subject.tokens.sign({ subject: name, roles, tenantId });
  const playerToken = (name: string) => subject.tokens.sign({ subject: name });
  const platformToken = () => subject.tokens.sign({ subject: 'ops', roles: ['platform_admin'] });

  async function call(
    method: 'get' | 'post' | 'delete',
    path: string,
    bearer: string,
    body?: object,
  ) {
    const pending = http()[method](path).set('authorization', `Bearer ${bearer}`);
    return body ? pending.send(body) : pending;
  }

  async function issue(bearer: string, body: object = permanentUpload()): Promise<string> {
    const response = await call('post', '/v1/media/issue-upload-url', bearer, body);
    expect(response.status).toBe(201);
    return response.body.result.mediaId as string;
  }

  async function row(id: string) {
    return prisma.mediaObject.findUniqueOrThrow({ where: { id } });
  }

  async function uploadObject(id: string, size = 100, contentType = PNG): Promise<void> {
    const media = await row(id);
    subject.storage.put(media.bucket, media.objectKey, size, contentType);
  }

  async function activeMedia(bearer: string, body: object = permanentUpload()): Promise<string> {
    const id = await issue(bearer, body);
    await uploadObject(id);
    const response = await call('post', `/v1/media/${id}/complete`, bearer);
    expect(response.status).toBe(200);
    return id;
  }

  describe('cấp URL tải lên', () => {
    it('trả URL ký sẵn và header bắt buộc', async () => {
      const response = await call(
        'post',
        '/v1/media/issue-upload-url',
        await token('alice'),
        permanentUpload(),
      );
      expect(response.status).toBe(201);
      expect(response.body.result).toMatchObject({
        method: 'PUT',
        lifecycle: 'PERMANENT',
        requiredHeaders: { 'Content-Type': PNG },
      });
      expect(response.body.result.uploadUrl).toContain('signature=put');
    });

    it('đặt object theo tenant và chủ sở hữu', async () => {
      const id = await issue(await token('alice'));
      expect((await row(id)).objectKey.startsWith(`${tenant}/avatar/user-1/`)).toBe(true);
    });

    it('bắt buộc có chủ sở hữu với media lâu dài', async () => {
      const response = await call('post', '/v1/media/issue-upload-url', await token('alice'), {
        contentType: PNG,
        declaredSizeBytes: 100,
      });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('MEDIA.INVALID_UPLOAD');
    });

    it('không cho media tạm có chủ sở hữu', async () => {
      const response = await call('post', '/v1/media/issue-upload-url', await token('alice'), {
        contentType: PNG,
        declaredSizeBytes: 100,
        temporary: true,
        ownerType: 'avatar',
      });
      expect(response.body.code).toBe('MEDIA.INVALID_UPLOAD');
    });

    it('báo 503 khi kho lưu trữ không phản hồi', async () => {
      subject.storage.unavailable = true;
      const response = await call(
        'post',
        '/v1/media/issue-upload-url',
        await token('alice'),
        permanentUpload(),
      );
      expect(response.status).toBe(503);
      expect(response.body.code).toBe('MEDIA.STORAGE_UNAVAILABLE');
    });
  });

  describe('chính sách theo lớp media', () => {
    const glb = { contentType: 'model/gltf-binary', originalFilename: 'chair.glb' };

    it('nội dung người dùng tải GLB bị từ chối', async () => {
      const response = await call(
        'post',
        '/v1/media/issue-upload-url',
        await token('alice'),
        permanentUpload(glb),
      );
      expect(response.status).toBe(415);
      expect(response.body.code).toBe('MEDIA.TYPE_NOT_ALLOWED');
    });

    it('asset hệ thống tải GLB được', async () => {
      const response = await call(
        'post',
        '/v1/media/issue-upload-url',
        await platformToken(),
        permanentUpload({ ...glb, mediaClass: 'SYSTEM_ASSET' }),
      );
      expect(response.status).toBe(201);
    });

    it('quản trị của tiệm không tạo được asset hệ thống', async () => {
      const response = await call(
        'post',
        '/v1/media/issue-upload-url',
        await token('shop-admin', ['admin']),
        permanentUpload({ ...glb, mediaClass: 'SYSTEM_ASSET' }),
      );
      expect(response.status).toBe(403);
    });

    it('người thường không tạo được asset hệ thống', async () => {
      const response = await call(
        'post',
        '/v1/media/issue-upload-url',
        await token('alice'),
        permanentUpload({ ...glb, mediaClass: 'SYSTEM_ASSET' }),
      );
      expect(response.status).toBe(403);
    });

    it('từ chối ngay khi dung lượng khai báo vượt mức', async () => {
      const response = await call(
        'post',
        '/v1/media/issue-upload-url',
        await token('alice'),
        permanentUpload({ declaredSizeBytes: 1001 }),
      );
      expect(response.status).toBe(413);
    });
  });

  describe('chống tạo trùng', () => {
    const issueWithKey = async (bearer: string, key: string, body: object) =>
      http()
        .post('/v1/media/issue-upload-url')
        .set('authorization', `Bearer ${bearer}`)
        .set('idempotency-key', key)
        .send(body);

    it('gọi lại cùng khoá trả đúng media cũ', async () => {
      const bearer = await token('alice');
      const key = randomUUID();
      const first = await issueWithKey(bearer, key, permanentUpload());
      const second = await issueWithKey(bearer, key, permanentUpload());
      expect(second.status).toBe(201);
      expect(second.body.result.mediaId).toBe(first.body.result.mediaId);
    });

    it('gọi lại cùng khoá sau lúc tải lên đã hoàn tất thì không cấp URL ghi nữa', async () => {
      const bearer = await token('alice');
      const key = randomUUID();
      const first = await issueWithKey(bearer, key, permanentUpload());
      const id = first.body.result.mediaId as string;
      await uploadObject(id);
      await call('post', `/v1/media/${id}/complete`, bearer);
      const replay = await issueWithKey(bearer, key, permanentUpload());
      expect(replay.status).toBe(409);
      expect(replay.body.code).toBe('MEDIA.ALREADY_COMPLETED');
      expect(replay.body.result).toBeUndefined();
    });

    it('khoá dùng lại với nội dung khác bị từ chối', async () => {
      const bearer = await token('alice');
      const key = randomUUID();
      await issueWithKey(bearer, key, permanentUpload());
      const response = await issueWithKey(bearer, key, permanentUpload({ ownerId: 'user-2' }));
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('MEDIA.IDEMPOTENCY_KEY_REUSED');
    });

    it('cùng khoá của hai người không lẫn nhau', async () => {
      const key = randomUUID();
      const first = await issueWithKey(await token('alice'), key, permanentUpload());
      const second = await issueWithKey(await token('bob'), key, permanentUpload());
      expect(second.body.result.mediaId).not.toBe(first.body.result.mediaId);
    });

    it('nhiều request đồng thời cùng khoá chỉ tạo một media', async () => {
      const bearer = await token('alice');
      const key = randomUUID();
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => issueWithKey(bearer, key, permanentUpload())),
      );
      const ids = new Set(responses.map((response) => response.body.result.mediaId));
      expect(responses.every((response) => response.status === 201)).toBe(true);
      expect(ids.size).toBe(1);
    });
  });

  describe('xác nhận tải lên', () => {
    it('kích hoạt media, ghi dung lượng thật và phát sự kiện cùng giao dịch', async () => {
      const bearer = await token('alice');
      const id = await issue(bearer);
      await uploadObject(id, 80);
      const response = await call('post', `/v1/media/${id}/complete`, bearer);
      expect(response.status).toBe(200);
      expect(response.body.result).toMatchObject({ status: 'ACTIVE', actualSizeBytes: 80 });
      const events = await prisma.outboxEvent.findMany({ where: { aggregateId: id } });
      expect(events.map((event) => event.type)).toEqual(['media.completed']);
    });

    it('báo lỗi khi object chưa có trong kho', async () => {
      const bearer = await token('alice');
      const id = await issue(bearer);
      const response = await call('post', `/v1/media/${id}/complete`, bearer);
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('MEDIA.OBJECT_MISSING');
      expect((await row(id)).status).toBe('PENDING');
    });

    it('không phát sự kiện khi xác nhận thất bại', async () => {
      const bearer = await token('alice');
      const id = await issue(bearer);
      await call('post', `/v1/media/${id}/complete`, bearer);
      expect(await prisma.outboxEvent.count({ where: { aggregateId: id } })).toBe(0);
    });

    it('từ chối và xoá file thật vượt mức dù khai báo nhỏ', async () => {
      const bearer = await token('alice');
      const id = await issue(bearer);
      await uploadObject(id, 5000);
      const media = await row(id);
      const response = await call('post', `/v1/media/${id}/complete`, bearer);
      expect(response.status).toBe(413);
      expect(subject.storage.has(media.bucket, media.objectKey)).toBe(false);
      expect((await row(id)).status).toBe('DELETED');
    });

    it('từ chối khi định dạng tải lên khác định dạng khai báo', async () => {
      const bearer = await token('alice');
      const id = await issue(bearer);
      await uploadObject(id, 100, 'text/html');
      const response = await call('post', `/v1/media/${id}/complete`, bearer);
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('MEDIA.CONTENT_TYPE_MISMATCH');
    });

    it('xác nhận lần hai bị từ chối', async () => {
      const bearer = await token('alice');
      const id = await activeMedia(bearer);
      const response = await call('post', `/v1/media/${id}/complete`, bearer);
      expect(response.status).toBe(409);
    });

    it('xác nhận đồng thời chỉ phát một sự kiện', async () => {
      const bearer = await token('alice');
      const id = await issue(bearer);
      await uploadObject(id);
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => call('post', `/v1/media/${id}/complete`, bearer)),
      );
      expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
      expect(await prisma.outboxEvent.count({ where: { aggregateId: id } })).toBe(1);
    });
  });

  describe('cách ly tenant và quyền', () => {
    it('media công khai của tiệm thì người chơi và tiệm khác đọc, tải được nhưng không xoá được', async () => {
      const id = await activeMedia(await token('alice'), permanentUpload({ visibility: 'PUBLIC' }));
      const visitors = [
        await playerToken('visitor'),
        await token('mallory', [], `tenant-${randomUUID()}`),
      ];
      for (const visitor of visitors) {
        expect((await call('get', `/v1/media/${id}`, visitor)).status).toBe(200);
        expect((await call('post', `/v1/media/${id}/issue-download-url`, visitor, {})).status).toBe(
          200,
        );
        expect((await call('delete', `/v1/media/${id}`, visitor)).status).toBe(404);
      }
      expect((await row(id)).status).toBe('ACTIVE');
    });

    it('media nội bộ của tiệm thì người chơi không đọc được', async () => {
      const id = await activeMedia(
        await token('alice'),
        permanentUpload({ visibility: 'INTERNAL' }),
      );
      expect((await call('get', `/v1/media/${id}`, await playerToken('visitor'))).status).toBe(404);
    });

    it('tenant khác không đọc, tải, xác nhận, xoá được media', async () => {
      const id = await activeMedia(await token('alice'));
      const outsider = await token('mallory', ['admin'], `tenant-${randomUUID()}`);
      expect((await call('get', `/v1/media/${id}`, outsider)).status).toBe(404);
      expect((await call('post', `/v1/media/${id}/issue-download-url`, outsider, {})).status).toBe(
        404,
      );
      expect((await call('post', `/v1/media/${id}/complete`, outsider)).status).toBe(404);
      expect((await call('delete', `/v1/media/${id}`, outsider)).status).toBe(404);
      expect((await row(id)).status).toBe('ACTIVE');
    });

    it('đồng nghiệp không thấy media riêng tư', async () => {
      const id = await activeMedia(await token('alice'));
      expect((await call('get', `/v1/media/${id}`, await token('bob'))).status).toBe(404);
    });

    it('đồng nghiệp xem được media nội bộ nhưng không xoá được', async () => {
      const id = await activeMedia(
        await token('alice'),
        permanentUpload({ visibility: 'INTERNAL' }),
      );
      const colleague = await token('bob');
      expect((await call('get', `/v1/media/${id}`, colleague)).status).toBe(200);
      expect((await call('delete', `/v1/media/${id}`, colleague)).status).toBe(404);
    });

    it('danh sách chỉ gồm media tenant mình và ẩn media riêng của người khác', async () => {
      const alice = await token('alice');
      await activeMedia(alice);
      await activeMedia(await token('bob'));
      await activeMedia(await token('outsider', [], `tenant-${randomUUID()}`));

      const mine = await call('get', '/v1/media', alice);
      expect(mine.body.result.totalElements).toBe(1);
      const admin = await call('get', '/v1/media?size=1', await token('ops', ['admin']));
      expect(admin.body.result).toMatchObject({ totalElements: 2, size: 1, totalPages: 2 });
    });
  });

  describe('media của người chơi, không gắn tenant', () => {
    const ownUpload = (name: string, overrides: Record<string, unknown> = {}) =>
      permanentUpload({ ownerId: name, ...overrides });

    it('người chơi không đọc, không tải, không xoá được media nội bộ của người chơi khác', async () => {
      const id = await activeMedia(
        await playerToken('ann'),
        ownUpload('ann', { visibility: 'INTERNAL' }),
      );
      const other = await playerToken('ben');
      expect((await call('get', `/v1/media/${id}`, other)).status).toBe(404);
      expect((await call('post', `/v1/media/${id}/issue-download-url`, other, {})).status).toBe(
        404,
      );
      expect((await call('delete', `/v1/media/${id}`, other)).status).toBe(404);
    });

    it('danh sách của người chơi chỉ gồm media của mình và media công khai', async () => {
      const owner = `ann-${randomUUID()}`;
      const viewer = `ben-${randomUUID()}`;
      const ann = await playerToken(owner);
      await activeMedia(ann, ownUpload(owner, { ownerType: 'list-case', visibility: 'INTERNAL' }));
      const shared = await activeMedia(
        ann,
        ownUpload(owner, { ownerType: 'list-case', visibility: 'PUBLIC' }),
      );
      const seen = await call(
        'get',
        `/v1/media?ownerType=list-case&ownerId=${owner}`,
        await playerToken(viewer),
      );
      expect(seen.body.result.content.map((item: { id: string }) => item.id)).toEqual([shared]);
      const mine = await call('get', `/v1/media?ownerType=list-case&ownerId=${owner}`, ann);
      expect(mine.body.result.totalElements).toBe(2);
    });

    it('media công khai không gắn tenant thì thành viên của một tiệm cũng đọc được', async () => {
      const id = await activeMedia(
        await playerToken('ann'),
        ownUpload('ann', { visibility: 'PUBLIC' }),
      );
      expect((await call('get', `/v1/media/${id}`, await token('alice'))).status).toBe(200);
    });

    it('người chơi không tải lên được dưới mã chủ sở hữu của người khác', async () => {
      const response = await call(
        'post',
        '/v1/media/issue-upload-url',
        await playerToken('ann'),
        ownUpload('ben'),
      );
      expect(response.status).toBe(403);
    });

    it('người chơi không chuyển được tệp tạm thành tệp dưới mã chủ sở hữu của người khác', async () => {
      const ann = await playerToken('ann');
      const id = await activeMedia(ann, {
        contentType: PNG,
        declaredSizeBytes: 100,
        temporary: true,
      });
      const target = { ownerType: 'avatar', ownerId: 'ben', visibility: 'PUBLIC' };
      expect((await call('post', `/v1/media/${id}/promote`, ann, target)).status).toBe(403);
      const batch = await call('post', '/v1/media/promote-batch', ann, {
        items: [{ mediaId: id, ...target }],
      });
      expect(batch.body.result.succeeded).toHaveLength(0);
      expect((await row(id)).lifecycle).toBe('TEMPORARY');
      const own = { ...target, ownerId: 'ann' };
      expect((await call('post', `/v1/media/${id}/promote`, ann, own)).status).toBe(200);
    });

    it('vai trò admin trên token không gắn tenant không mở được media của người chơi', async () => {
      const id = await activeMedia(await playerToken('ann'), ownUpload('ann'));
      const forged = await subject.tokens.sign({ subject: 'eve', roles: ['admin'] });
      expect((await call('get', `/v1/media/${id}`, forged)).status).toBe(404);
    });

    it('quản trị nền tảng đọc được media của người chơi và của mọi tiệm', async () => {
      const playerFile = await activeMedia(await playerToken('ann'), ownUpload('ann'));
      const shopFile = await activeMedia(await token('alice'));
      const platform = await platformToken();
      expect((await call('get', `/v1/media/${playerFile}`, platform)).status).toBe(200);
      expect((await call('get', `/v1/media/${shopFile}`, platform)).status).toBe(200);
    });
  });

  describe('kiểm duyệt', () => {
    let moderated: TestApp;
    const moderatedHttp = () => request(moderated.app.getHttpServer());
    const moderationTenant = `tenant-${randomUUID()}`;

    beforeAll(async () => {
      moderated = await createTestApp({ MEDIA_USER_CONTENT_REQUIRES_REVIEW: 'true' });
    });

    afterAll(() => moderated.close());

    const bearerFor = (name: string, roles: string[] = []) =>
      moderated.tokens.sign({ subject: name, roles, tenantId: moderationTenant });

    async function pendingReview(): Promise<{
      id: string;
      owner: string;
      viewer: string;
      manager: string;
      shopAdmin: string;
    }> {
      const [owner, viewer, manager, shopAdmin] = await Promise.all([
        bearerFor('owner'),
        bearerFor('viewer'),
        moderated.tokens.sign({ subject: 'ops', roles: ['platform_admin'] }),
        bearerFor('shop-admin', ['admin']),
      ]);
      const issued = await moderatedHttp()
        .post('/v1/media/issue-upload-url')
        .set('authorization', `Bearer ${owner}`)
        .send(permanentUpload({ visibility: 'INTERNAL' }));
      const id = issued.body.result.mediaId as string;
      const media = await moderated.app
        .get(PrismaService)
        .mediaObject.findUniqueOrThrow({ where: { id } });
      moderated.storage.put(media.bucket, media.objectKey, 10, PNG);
      await moderatedHttp()
        .post(`/v1/media/${id}/complete`)
        .set('authorization', `Bearer ${owner}`)
        .expect(200);
      return { id, owner, viewer, manager, shopAdmin };
    }

    const download = (id: string, bearer: string) =>
      moderatedHttp()
        .post(`/v1/media/${id}/issue-download-url`)
        .set('authorization', `Bearer ${bearer}`)
        .send({});

    const decide = (id: string, bearer: string, decision: string) =>
      moderatedHttp()
        .post(`/v1/media/${id}/moderation`)
        .set('authorization', `Bearer ${bearer}`)
        .send({ decision });

    it('chờ duyệt thì người khác chưa tải được', async () => {
      const { id, viewer, owner } = await pendingReview();
      expect((await download(id, viewer)).status).toBe(403);
      expect((await download(id, owner)).status).toBe(200);
    });

    it('duyệt xong mọi người trong tenant tải được', async () => {
      const { id, viewer, manager } = await pendingReview();
      await decide(id, manager, 'APPROVED').expect(200);
      expect((await download(id, viewer)).status).toBe(200);
    });

    it('bị từ chối thì chính người tạo cũng không tải được', async () => {
      const { id, owner, manager } = await pendingReview();
      await decide(id, manager, 'REJECTED').expect(200);
      const response = await download(id, owner);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('MEDIA.MODERATION_BLOCKED');
    });

    it('người thường không duyệt được', async () => {
      const { id, owner } = await pendingReview();
      await decide(id, owner, 'APPROVED').expect(403);
    });

    it('quản trị của tiệm không duyệt được nội dung của chính tiệm mình', async () => {
      const { id, shopAdmin } = await pendingReview();
      await decide(id, shopAdmin, 'APPROVED').expect(403);
      expect((await download(id, shopAdmin)).status).toBe(403);
    });

    it('token gắn tenant mang tên vai trò nền tảng không duyệt được', async () => {
      const { id } = await pendingReview();
      const forged = await bearerFor('eve', ['platform_admin']);
      await decide(id, forged, 'APPROVED').expect(403);
    });
  });

  describe('tải xuống và xoá', () => {
    it('chỉ cấp URL cho media đã kích hoạt', async () => {
      const bearer = await token('alice');
      const id = await issue(bearer);
      const response = await call('post', `/v1/media/${id}/issue-download-url`, bearer, {});
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('MEDIA.NOT_ACTIVE');
    });

    it('cấp URL theo thời hạn yêu cầu', async () => {
      const bearer = await token('alice');
      const id = await activeMedia(bearer);
      const response = await call('post', `/v1/media/${id}/issue-download-url`, bearer, {
        ttlSeconds: 120,
      });
      expect(response.body.result.downloadUrl).toContain('ttl=120');
    });

    it('xoá mềm phát sự kiện và xoá lần hai vẫn ổn', async () => {
      const bearer = await token('alice');
      const id = await activeMedia(bearer);
      expect((await call('delete', `/v1/media/${id}`, bearer)).status).toBe(204);
      expect((await call('delete', `/v1/media/${id}`, bearer)).status).toBe(204);
      const types = (await prisma.outboxEvent.findMany({ where: { aggregateId: id } })).map(
        (event) => event.type,
      );
      expect(types.filter((type) => type === 'media.deleted')).toHaveLength(1);
    });

    it('không xoá được media đang trong thời hạn lưu giữ', async () => {
      const bearer = await token('alice');
      const retentionUntil = new Date(Date.now() + 3_600_000).toISOString();
      const id = await activeMedia(bearer, permanentUpload({ retentionUntil }));
      const response = await call('delete', `/v1/media/${id}`, bearer);
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('MEDIA.RETENTION_HOLD');
    });
  });

  describe('chuyển media tạm thành lâu dài', () => {
    const temporary = {
      contentType: PNG,
      declaredSizeBytes: 100,
      temporary: true,
      originalFilename: 'draft.png',
    };
    const target = { ownerType: 'post', ownerId: 'post-9' };

    it('chép object sang bucket lâu dài và xoá bản tạm', async () => {
      const bearer = await token('alice');
      const id = await activeMedia(bearer, temporary);
      const before = await row(id);
      const response = await call('post', `/v1/media/${id}/promote`, bearer, {
        ...target,
        visibility: 'INTERNAL',
      });
      expect(response.status).toBe(200);
      expect(response.body.result).toMatchObject({
        lifecycle: 'PERMANENT',
        expiresAt: null,
        ownerId: 'post-9',
      });
      const after = await row(id);
      expect(after.bucket).toBe('test-internal');
      expect(subject.storage.has(after.bucket, after.objectKey)).toBe(true);
      expect(subject.storage.has(before.bucket, before.objectKey)).toBe(false);
    });

    it('không chuyển được media chưa tải xong', async () => {
      const bearer = await token('alice');
      const id = await issue(bearer, temporary);
      const response = await call('post', `/v1/media/${id}/promote`, bearer, target);
      expect(response.body.code).toBe('MEDIA.NOT_ACTIVE');
    });

    it('không chuyển được media đã hết hạn', async () => {
      const bearer = await token('alice');
      const id = await activeMedia(bearer, temporary);
      await prisma.mediaObject.update({
        where: { id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const response = await call('post', `/v1/media/${id}/promote`, bearer, target);
      expect(response.body.code).toBe('MEDIA.EXPIRED');
    });

    it('chuyển lần hai không đổi gì', async () => {
      const bearer = await token('alice');
      const id = await activeMedia(bearer, temporary);
      await call('post', `/v1/media/${id}/promote`, bearer, target);
      const key = (await row(id)).objectKey;
      await call('post', `/v1/media/${id}/promote`, bearer, target);
      expect((await row(id)).objectKey).toBe(key);
    });

    it('xử lý từng phần trong lô, phần lỗi không làm hỏng phần còn lại', async () => {
      const bearer = await token('alice');
      const good = await activeMedia(bearer, temporary);
      const missing = randomUUID();
      const response = await call('post', '/v1/media/promote-batch', bearer, {
        items: [
          { mediaId: good, ...target },
          { mediaId: missing, ...target },
        ],
      });
      expect(response.status).toBe(200);
      expect(response.body.result.succeeded).toHaveLength(1);
      expect(response.body.result.failed).toEqual([
        { mediaId: missing, errorCode: 'MEDIA.NOT_FOUND', message: 'Media not found' },
      ]);
    });

    it('từ chối lô quá 50 phần tử', async () => {
      const items = Array.from({ length: 51 }, () => ({ mediaId: randomUUID(), ...target }));
      const response = await call('post', '/v1/media/promote-batch', await token('alice'), {
        items,
      });
      expect(response.status).toBe(400);
    });
  });

  describe('dọn dẹp định kỳ', () => {
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

    it('xoá media chờ tải quá hạn cả trong kho lẫn database', async () => {
      const id = await issue(await token('alice'));
      await uploadObject(id);
      const media = await row(id);
      await prisma.mediaObject.update({ where: { id }, data: { createdAt: hoursAgo(2) } });
      await subject.app.get(PendingReaper).runOnce();
      expect(await prisma.mediaObject.findUnique({ where: { id } })).toBeNull();
      expect(subject.storage.has(media.bucket, media.objectKey)).toBe(false);
    });

    it('không xoá media chờ tải còn trong hạn', async () => {
      const id = await issue(await token('alice'));
      await subject.app.get(PendingReaper).runOnce();
      expect(await prisma.mediaObject.findUnique({ where: { id } })).not.toBeNull();
    });

    it('xoá media tạm đã hết hạn', async () => {
      const bearer = await token('alice');
      const id = await activeMedia(bearer, {
        contentType: PNG,
        declaredSizeBytes: 100,
        temporary: true,
      });
      await prisma.mediaObject.update({ where: { id }, data: { expiresAt: hoursAgo(1) } });
      await subject.app.get(TemporaryReaper).runOnce();
      expect((await row(id)).status).toBe('DELETED');
    });

    it('xoá hẳn object sau thời gian ân hạn nhưng tôn trọng thời hạn lưu giữ', async () => {
      const bearer = await token('alice');
      const expired = await activeMedia(bearer);
      await call('delete', `/v1/media/${expired}`, bearer);
      await prisma.mediaObject.update({ where: { id: expired }, data: { deletedAt: hoursAgo(2) } });

      const held = await activeMedia(bearer);
      await prisma.mediaObject.update({
        where: { id: held },
        data: {
          status: 'DELETED',
          deletedAt: hoursAgo(2),
          retentionUntil: new Date(Date.now() + 3_600_000),
        },
      });

      await subject.app.get(HardDeleteReaper).runOnce();
      expect((await row(expired)).hardDeletedAt).not.toBeNull();
      expect((await row(held)).hardDeletedAt).toBeNull();
    });

    it('giữ lại bản ghi để thử lại khi kho không xoá được object', async () => {
      const id = await issue(await token('alice'));
      await prisma.mediaObject.update({ where: { id }, data: { createdAt: hoursAgo(2) } });
      subject.storage.unavailable = true;
      await subject.app.get(PendingReaper).runOnce();
      expect(await prisma.mediaObject.findUnique({ where: { id } })).not.toBeNull();
    });

    it('hai tiến trình không chạy cùng một job, và khoá được nhả sau khi xong', async () => {
      const reaper = subject.app.get(PendingReaper);
      const blocking = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(7101::bigint)::text`;
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const id = await issue(await token('alice'));
      await prisma.mediaObject.update({ where: { id }, data: { createdAt: hoursAgo(2) } });
      expect(await reaper.runOnce()).toBe(0);
      await blocking;
      expect(await reaper.runOnce()).toBeGreaterThan(0);
    });
  });

  describe('phát sự kiện', () => {
    let delivered: EventEnvelope[];
    let publisher: EventPublisher;
    let original: EventPublisher['publish'];

    beforeEach(async () => {
      delivered = [];
      publisher = subject.app.get(EventPublisher, { strict: false });
      original = publisher.publish.bind(publisher);
      publisher.publish = async (event) => {
        delivered.push(event);
      };
      await prisma.outboxEvent.updateMany({
        where: { status: 'PENDING' },
        data: { status: 'PUBLISHED' },
      });
    });

    afterEach(() => {
      publisher.publish = original;
    });

    it('chuyển sự kiện đã lưu ra ngoài và đánh dấu đã gửi', async () => {
      const id = await activeMedia(await token('alice'));
      await subject.app.get(OutboxRelayJob, { strict: false }).runOnce();
      expect(delivered.map((event) => [event.type, event.source, event.data.mediaId])).toEqual([
        ['media.completed', 'service-under-test', id],
      ]);
      const [event] = await prisma.outboxEvent.findMany({ where: { aggregateId: id } });
      expect(event?.status).toBe('PUBLISHED');
    });

    it('không gửi lại sự kiện đã gửi', async () => {
      await activeMedia(await token('alice'));
      const relay = subject.app.get(OutboxRelayJob, { strict: false });
      await relay.runOnce();
      await relay.runOnce();
      expect(delivered).toHaveLength(1);
    });

    it('broker lỗi thì sự kiện được thử lại mãi, không bị chôn, và được phát lúc broker trở lại', async () => {
      const relay = subject.app.get(OutboxRelayJob, { strict: false });
      await relay.runOnce();
      const id = await activeMedia(await token('alice'));
      const working = publisher.publish.bind(publisher);
      publisher.publish = async () => {
        throw new Error('broker down');
      };
      const load = () => prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: id } });
      const dueNow = async () =>
        prisma.outboxEvent.updateMany({
          where: { aggregateId: id },
          data: { nextAttemptAt: new Date(0) },
        });

      await relay.runOnce();
      expect(await load()).toMatchObject({
        status: 'PENDING',
        attempts: 1,
        lastError: 'broker down',
      });
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await dueNow();
        await relay.runOnce();
      }
      const stuck = await load();
      expect(stuck).toMatchObject({ status: 'PENDING', attempts: 5 });
      expect(stuck.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

      publisher.publish = working;
      await dueNow();
      await relay.runOnce();
      expect(await load()).toMatchObject({ status: 'PUBLISHED', lastError: null });
    });

    it('sự kiện chưa gửi được thì sự kiện sau chờ, không vượt lên trước', async () => {
      const relay = subject.app.get(OutboxRelayJob, { strict: false });
      await relay.runOnce();
      const first = await activeMedia(await token('alice'));
      const second = await activeMedia(await token('alice'));
      const working = publisher.publish.bind(publisher);
      const sent: string[] = [];
      let brokerUp = false;
      publisher.publish = async (event) => {
        if (!brokerUp) {
          throw new Error('broker down');
        }
        sent.push(event.id);
        return working(event);
      };
      const idOf = async (aggregateId: string) =>
        (await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId } })).id;

      await relay.runOnce();
      expect(sent).toHaveLength(0);
      const waiting = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: second } });
      expect(waiting).toMatchObject({ status: 'PENDING', attempts: 0 });

      brokerUp = true;
      await prisma.outboxEvent.updateMany({
        where: { aggregateId: first },
        data: { nextAttemptAt: new Date(0) },
      });
      await relay.runOnce();
      publisher.publish = working;
      expect(sent).toEqual([await idOf(first), await idOf(second)]);
    });
  });

  describe('sức khoẻ dịch vụ', () => {
    it('báo 503 khi kho lưu trữ hỏng', async () => {
      subject.storage.unavailable = true;
      await http().get('/healthz').expect(503);
    });
  });
});
