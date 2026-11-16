# e2e

Kiểm đầu cuối trên cả hệ: dựng các service bằng `infra/compose`, đi qua cổng vào và chạy một luồng nghiệp vụ trọn vẹn, ví dụ đăng ký, mở tiệm, trả tiền, vào phòng.

- Chạy ở bước phát hành staging, không chạy ở mỗi PR.
- Mỗi thành phần chạy ở phiên bản staging hiện hành của nó, theo [ADR-0022](../../docs/decisions/ADR-0022-per-component-release-tags.md).
- `stack-smoke.mjs` là kịch bản đầu tiên: đăng ký và đăng nhập ở `identity`, rồi tải lên và tải về ở `media` bằng token đó. Cách chạy ở [runbook](../../docs/runbooks/stack-smoke.md).

## Bộ kiểm cổng vào

`gateway/gateway.test.mjs` kiểm hành vi của cổng qua mạng thật: định tuyến theo `/api/<service>/v1`, chặn đường nội bộ, không thoát tiền tố bằng `..`, không nhận `X-Forwarded-For` giả, giới hạn tần suất và cỡ body, header an toàn của web, WebSocket, cổng storage.

| Biến                  | Mặc định                 | Ý nghĩa                                                          |
| --------------------- | ------------------------ | ---------------------------------------------------------------- |
| `GATEWAY_URL`         | `http://127.0.0.1:58080` | Cổng web                                                         |
| `GATEWAY_STORAGE_URL` | `http://127.0.0.1:58334` | Cổng storage                                                     |
| `GATEWAY_WS_PROBE`    | không đặt                | `1` khi có route thử `/ws/_probe`; cần cho ca WebSocket và ca IP |

Chạy với Compose: `GATEWAY_WS_PROBE=1 pnpm test:gateway`. Chạy với cụm local: đặt thêm `GATEWAY_URL=http://127.0.0.1:58180` và `GATEWAY_STORAGE_URL=http://127.0.0.1:58335`. Ca giới hạn tần suất dùng hết hạn mức của đường xác thực trong một phút, nên chờ một phút trước khi chạy lại.

`lib/http.mjs` gửi yêu cầu với đường dẫn nguyên văn và kiểm WebSocket ở mức giao thức; unit test của nó chạy bằng `pnpm test:e2e-lib`.
