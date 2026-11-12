# Chạy thử identity và media trên hạ tầng dev

Dùng lúc cần biết hai service chạy thật được cùng nhau: sau khi sửa `services/identity`, `services/media`, `packages/nest-kit`, một `Dockerfile` hoặc `infra/compose`. Chạy lần lượt, bước nào sai kết quả mong đợi thì dừng ở đó.

Cần Docker đang chạy và Node 22 trên máy. Các lệnh chạy từ gốc repo. Để ngắn, đặt:

```
COMPOSE="docker compose --env-file .env.example -f infra/compose/compose.yaml --profile apps"
```

## 1. Bật hạ tầng

```
pnpm infra:up
```

Kết quả mong đợi: lệnh kết thúc với mã 0. `curl http://127.0.0.1:58333/healthz` trả 200.

## 2. Dựng và chạy hai service

```
$COMPOSE up -d --build --wait identity media
```

Lệnh dựng image từ gốc repo, chạy migration của từng service vào database riêng, chạy `identity` rồi tới `media`. `media` chỉ khởi động sau lúc `identity` khoẻ, vì nó lấy khoá công khai từ `identity` để kiểm token.

Kết quả mong đợi:

| Kiểm                                                | Kết quả                              |
| --------------------------------------------------- | ------------------------------------ |
| `curl http://127.0.0.1:53002/healthz`               | 200                                  |
| `curl http://127.0.0.1:53002/.well-known/jwks.json` | 200, có ít nhất một khoá             |
| `curl http://127.0.0.1:53001/healthz`               | 200, tức đã nối được database và kho |
| `$COMPOSE ps -a identity-migrate media-migrate`     | cả hai `Exited (0)`                  |

Một service không lên thì xem `$COMPOSE logs identity` hoặc `$COMPOSE logs media`.

## 3. Chạy kịch bản xuyên hai service

```
pnpm smoke:stack
```

Kịch bản `tests/e2e/stack-smoke.mjs` chạy trên máy thật, như một client ở ngoài mạng Docker. Nó mở cổng 4100 trên máy để nhận mã xác minh email mà `identity` gửi qua webhook, và tải tệp qua URL ký sẵn trỏ tới `localhost:58333`.

Kịch bản làm lần lượt:

1. Gọi `media` không có token, phải bị từ chối.
2. Đăng ký một người chơi ở `identity`, nhận mã xác minh, xác minh email, đăng nhập. Token không gắn tenant.
3. Dùng token đó tải một tệp lên `media`, báo hoàn tất, tải về và so nội dung.
4. Một người chơi thứ hai xin tệp của người chơi đầu, tìm nó trong danh sách, rồi thử tải lên dưới mã chủ sở hữu của người chơi đầu. Cả ba đều phải bị từ chối.
5. Quản trị nền tảng tạo tenant cho một tiệm, tạo vai trò `admin` của tiệm và thêm một tài khoản làm thành viên.
6. Chủ tiệm đăng nhập vào tenant của tiệm, tải một tệp nội bộ lên và tải về trong tenant đó.
7. Người chơi ở bước 2 xin tệp nội bộ của tiệm, phải nhận 404.
8. Chủ tiệm tải lên một tệp công khai. Người chơi đọc và tải về được, nhưng xoá thì nhận 404.
9. Chủ tiệm tự duyệt tệp của tiệm mình, phải nhận 403.
10. Quản trị nền tảng duyệt tệp của tiệm và tệp của người chơi, cả hai đều được.

Kết quả mong đợi: dòng cuối là `STACK SMOKE PASSED`, mã thoát 0.

Trên Linux không dùng Docker Desktop, container gọi về máy qua địa chỉ cầu nối chứ không qua loopback, nên chạy với `SMOKE_OTP_HOST=0.0.0.0 pnpm smoke:stack`.

## 4. Dọn

```
$COMPOSE down
pnpm infra:down
```

Hai lệnh này dừng và xoá container, giữ lại dữ liệu trong volume. Kịch bản để lại tài khoản và tệp thử trong database `identity`, `media` và trong kho; xoá volume lúc chắc không cần dữ liệu đó nữa.

## Giới hạn đã biết

- Compose chạy hai service ở chế độ development, là chế độ duy nhất nhận giá trị mẫu; ở production service từ chối khởi động với các giá trị này. Các khoá và mật khẩu mặc định trong `infra/compose/compose.yaml` chỉ dành cho local. Môi trường thật phải đặt `IDENTITY_KEY_ENCRYPTION_SECRET`, `IDENTITY_OTP_HASH_SECRET`, `IDENTITY_OTP_WEBHOOK_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD` và khoá của kho bằng giá trị riêng.
- URL ký sẵn trong Compose trỏ tới `localhost:58333`, dùng được từ máy dev nhưng không dùng được từ một container khác trong mạng Docker. Client chạy trong mạng Docker thì đặt `MEDIA_S3_PUBLIC_ENDPOINT=object-store` và `MEDIA_S3_PUBLIC_PORT=8333` trước lúc chạy `media`.
- Mã xác minh email ở đây đi qua webhook tới chính kịch bản thử. Gửi email thật qua `notification` chưa có.

## Chạy riêng media với bộ phát token mẫu

Lúc chỉ cần thử `media` mà không dựng `identity`, chạy `pnpm --filter @netverse/media dev:issuer` trên máy, đặt `MEDIA_AUTH_JWKS_URL=http://host.docker.internal:4000/.well-known/jwks.json` và `MEDIA_AUTH_ISSUER=http://localhost:4000`, dựng lại `media`, rồi chạy `SMOKE_BASE_URL=http://127.0.0.1:53001 node services/media/scripts/smoke.mjs` trên máy. Trên Linux không dùng Docker Desktop, chạy bộ phát với `DEV_ISSUER_HOST=0.0.0.0`, và chỉ làm vậy trên máy dev vì bộ phát này cấp token cho bất kỳ ai gọi tới.
