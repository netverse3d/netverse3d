# Chạy thử identity, media và notification trên hạ tầng dev

Dùng lúc cần biết các service chạy thật được cùng nhau: sau khi sửa `services/identity`, `services/media`, `services/notification`, `packages/nest-kit`, một `Dockerfile` hoặc `infra/compose`. Chạy lần lượt, bước nào sai kết quả mong đợi thì dừng ở đó.

Cần Docker đang chạy và Node 22 trên máy. Các lệnh chạy từ gốc repo. Để ngắn, đặt:

```
COMPOSE="docker compose --env-file .env.example -f infra/compose/compose.yaml --profile apps"
```

## 1. Bật hạ tầng

```
pnpm infra:up
```

Kết quả mong đợi: lệnh kết thúc với mã 0. `curl http://127.0.0.1:58333/healthz` trả 200. Kafka nghe ở `127.0.0.1:59092`, hộp thư giả lập ở `http://127.0.0.1:58025`.

## 2. Dựng và chạy các service

```
$COMPOSE up -d --build --wait identity media notification
```

Lệnh dựng image từ gốc repo, chạy migration của từng service vào database riêng, chạy `identity` rồi tới `media` và `notification`. Hai service sau chỉ khởi động sau lúc `identity` khoẻ, vì chúng lấy khoá công khai từ `identity` để kiểm token.

Kết quả mong đợi:

| Kiểm                                                                 | Kết quả                                             |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| `curl http://127.0.0.1:53002/healthz`                                | 200                                                 |
| `curl http://127.0.0.1:53002/.well-known/jwks.json`                  | 200, có ít nhất một khoá                            |
| `curl http://127.0.0.1:53001/healthz`                                | 200, tức đã nối được database và kho                |
| `curl http://127.0.0.1:53003/healthz`                                | 200, tức cả máy chủ gRPC của notification đang nghe |
| `$COMPOSE ps -a identity-migrate media-migrate notification-migrate` | cả ba `Exited (0)`                                  |

Một service không lên thì xem `$COMPOSE logs` kèm tên service đó.

## 3. Chạy kịch bản xuyên các service

```
pnpm smoke:stack
```

Kịch bản `tests/e2e/stack-smoke.mjs` chạy trên máy thật, như một client ở ngoài mạng Docker. Nó đọc mã xác minh email từ hộp thư giả lập, nơi `notification` gửi mã thay cho `identity`, và tải tệp qua URL ký sẵn trỏ tới `localhost:58333`.

Kịch bản làm lần lượt:

1. Gọi `media` không có token, phải bị từ chối.
2. Quản trị nền tảng tạo hai template giao dịch cho mã một lần ở `notification`. Rồi đăng ký một người chơi ở `identity`, đọc mã xác minh từ email mà `notification` gửi tới hộp thư giả lập, xác minh email, đăng nhập. Token không gắn tenant.
3. Dùng token đó tải một tệp lên `media`, báo hoàn tất, tải về và so nội dung.
4. Một người chơi thứ hai xin tệp của người chơi đầu, tìm nó trong danh sách, rồi thử tải lên dưới mã chủ sở hữu của người chơi đầu. Cả ba đều phải bị từ chối.
5. Quản trị nền tảng tạo tenant cho một tiệm, tạo vai trò `admin` của tiệm và thêm một tài khoản làm thành viên.
6. Chủ tiệm đăng nhập vào tenant của tiệm, tải một tệp nội bộ lên và tải về trong tenant đó.
7. Người chơi ở bước 2 xin tệp nội bộ của tiệm, phải nhận 404.
8. Chủ tiệm tải lên một tệp công khai. Người chơi đọc và tải về được, nhưng xoá thì nhận 404.
9. Chủ tiệm tự duyệt tệp của tiệm mình, phải nhận 403.
10. Quản trị nền tảng duyệt tệp của tiệm và tệp của người chơi, cả hai đều được.
11. Chủ tiệm tạo một template cho hộp thư trong ứng dụng ở `notification`, gửi một thông báo cho chính mình, rồi đọc thấy nó trong hộp thư với tiêu đề đã render.
12. Chủ tiệm đặt tên thương hiệu, tạo một template email rồi gửi. Lệnh chỉ có địa chỉ bị từ chối với `NOTIFICATION.RECIPIENT_SUBJECT_REQUIRED`; lệnh có mã người nhận thì đi. Kịch bản đọc hộp thư giả lập và phải thấy đúng tiêu đề, tên người gửi là tên tiệm, và biến đã được thoát HTML.
13. Người chơi gọi hộp thư bằng token không gắn tenant và đọc được hộp thư của phạm vi nền tảng, nhưng không vào được phần quản trị.
14. Quản trị nền tảng tạo một tài khoản service ở `identity`; tài khoản đó đổi mã và khoá bí mật lấy token cho `media`. Token không gắn tenant và chỉ có audience `media`.
15. Token của service gọi một route của người dùng ở `media`, phải nhận 403. Tài khoản đó xin token cho `notification`, là audience nó không được cấp, cũng phải nhận 403.
16. Đọc topic `netverse.identity.events.v1` trên Kafka, phải thấy sự kiện đăng ký của người chơi ở bước 2 với khoá `platform`, và sự kiện thêm thành viên của tiệm với khoá là mã tenant.
17. Đọc topic `netverse.notification.events.v1`, phải thấy sự kiện gửi xong của thông báo ở bước 11, không chứa địa chỉ email.
18. Một tài khoản service có quyền `notification:send` gọi lệnh gửi qua gRPC ở `127.0.0.1:53103`, nêu tiệm ở bước 5. Chủ tiệm đọc thấy thông báo trong hộp thư. Gọi lại cùng khoá chống trùng trả đúng thông báo cũ.
19. Quản trị nền tảng tạo một template ở phạm vi nền tảng, chủ tiệm không thấy template đó. Tài khoản service gửi lệnh với phạm vi nền tảng tới người chơi, và người chơi đọc được trong hộp thư của mình.
20. Lệnh gRPC không có token, mang token của chủ tiệm, hoặc mang token của một tài khoản service không có quyền gửi đều bị từ chối.

Kết quả mong đợi: dòng cuối là `STACK SMOKE PASSED`, mã thoát 0.

## 4. Dọn

```
$COMPOSE down
pnpm infra:down
```

Hai lệnh này dừng và xoá container, giữ lại dữ liệu trong volume. Kịch bản để lại tài khoản và tệp thử trong database `identity`, `media` và trong kho; xoá volume lúc chắc không cần dữ liệu đó nữa.

## Giới hạn đã biết

- Compose chạy hai service ở chế độ development, là chế độ duy nhất nhận giá trị mẫu; ở production service từ chối khởi động với các giá trị này. Các khoá và mật khẩu mặc định trong `infra/compose/compose.yaml` chỉ dành cho local. Môi trường thật phải đặt `IDENTITY_KEY_ENCRYPTION_SECRET`, `IDENTITY_OTP_HASH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD` và khoá của kho bằng giá trị riêng.
- URL ký sẵn trong Compose trỏ tới `localhost:58333`, dùng được từ máy dev nhưng không dùng được từ một container khác trong mạng Docker. Client chạy trong mạng Docker thì đặt `MEDIA_S3_PUBLIC_ENDPOINT=object-store` và `MEDIA_S3_PUBLIC_PORT=8333` trước lúc chạy `media`.
- Mã xác minh email đi từ `identity` qua lệnh gRPC của `notification` rồi tới hộp thư giả lập. Quản trị nền tảng phải tạo template cho mã trước; kịch bản làm việc đó ở bước đầu. Ở môi trường thật đây là một bước cài đặt, ghi ở README của `identity`.
- Email của `notification` trong Compose đi qua SMTP tới hộp thư giả lập, xem được ở `http://127.0.0.1:58025`; không có thư nào ra ngoài. Kênh push ghi ra log.

## Chạy riêng media với bộ phát token mẫu

Lúc chỉ cần thử `media` mà không dựng `identity`, chạy `pnpm --filter @netverse/media dev:issuer` trên máy, đặt `MEDIA_AUTH_JWKS_URL=http://host.docker.internal:4000/.well-known/jwks.json` và `MEDIA_AUTH_ISSUER=http://localhost:4000`, dựng lại `media`, rồi chạy `SMOKE_BASE_URL=http://127.0.0.1:53001 node services/media/scripts/smoke.mjs` trên máy. Trên Linux không dùng Docker Desktop, chạy bộ phát với `DEV_ISSUER_HOST=0.0.0.0`, và chỉ làm vậy trên máy dev vì bộ phát này cấp token cho bất kỳ ai gọi tới.
