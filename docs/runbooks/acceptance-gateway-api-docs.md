# Nghiệm thu một Swagger UI qua Gateway trong môi trường phát triển

Liên quan [REQ-047](../requirements/index.md), [ADR-0034](../decisions/ADR-0034-api-gateway.md) và [cách vận hành Gateway](./gateway.md). Chạy từ gốc repo, chỉ dùng tài khoản và dữ liệu thử.

## 0. Phạm vi và bằng chứng

| Trạng thái                 | Bằng chứng                                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đã đo                      | Compose dev qua cổng: `/docs/`, cấu hình menu và ba JSON trả 200. Compose gốc với web chạy: các URL đó trả 404.                                                                                                                                                           |
| Đã đo                      | k3d local tại `58180`: Deployment sẵn sàng, HTTPRoute được chấp nhận, UI và ba JSON trả 200; `/api/identity/docs-json` trả 404; trình duyệt chọn cả ba mục và hiện đúng tiêu đề, endpoint; `pnpm test:gateway` đạt 12/12; `pnpm smoke:k8s` kết thúc `STACK SMOKE PASSED`. |
| Đã đo                      | `pnpm k8s:check`: platform 91, local 64, staging 39 tài nguyên hợp lệ; invalid, errors, skipped và policy problems đều bằng 0.                                                                                                                                            |
| Suy ra từ cấu hình đã kiểm | Overlay staging không sinh Deployment, Service, HTTPRoute của `api-docs`; bốn service có `NODE_ENV=production` và `SWAGGER_ENABLED=false`.                                                                                                                                |
| Chưa làm                   | Chưa triển khai và gọi HTTP trên staging hoặc production thật. Khi có môi trường, chạy lại TC-01 trên URL đó.                                                                                                                                                             |

## 1. Tiền đề

- Dev Compose: bật bằng `pnpm infra:up`, rồi chạy `docker compose --env-file .env.example -f infra/compose/compose.yaml -f infra/compose/compose.dev.yaml --profile apps up -d --build --wait`.
- Dev k3d: chạy `pnpm k8s:up` theo [runbook Kubernetes local](./k8s-local.md). Cổng web mặc định là `http://127.0.0.1:58180`; Compose là `http://127.0.0.1:58080`.
- Bản Compose gốc là đối chứng không tài liệu: chạy chỉ với `infra/compose/compose.yaml` trên cổng thử riêng. Không dùng dự án Compose đang có dữ liệu thật để thay cấu hình.
- Ký hiệu `BASE` là URL cổng web của môi trường đang kiểm. `P1` là tài khoản người chơi thử đã đăng nhập, `A1` là quản trị nền tảng thử. Không ghi token vào báo cáo.

## 2. Ca kiểm

Một thao tác có thể báo thành công dù không đổi trạng thái; vì vậy luôn đọc lại URL, nội dung đặc tả hoặc mã lỗi sau khi đổi lựa chọn và sau khi gửi yêu cầu.

#### TC-01 · Cấu hình không tài liệu không phục vụ UI hoặc JSON [âm]

**Kỳ vọng:** Trên Compose gốc, GET `/docs/`, `/docs/config.json`, `/docs/identity.json`, `/docs/media.json`, `/docs/notification.json` đều trả 404. Ở staging/production thật, năm URL đó và `/api/identity/docs-json` cũng trả 404; không có Deployment, Service hoặc HTTPRoute `api-docs`.

**Bước:** Gọi từng đường từ cùng `BASE`, đọc cả status và `Content-Type`; với Kubernetes đọc `kubectl get deploy,svc,httproute -n netverse`. Nếu thấy 200 hoặc lỗi upstream 502/504, giả thuyết “không triển khai docs” sai; dừng nghiệm thu và kiểm cấu hình Gateway cùng pod UI.

**Nếu khác kỳ vọng:** Giả thuyết sai; dừng nghiệm thu và kiểm route cùng pod UI.

#### TC-02 · Một URL mở UI và menu ba service [dương]

**Kỳ vọng:** Trên dev, GET `/docs/` trả 200 với HTML Swagger UI; `/docs/config.json` trả 200 với đúng ba mục Identity, Media, Notification. Menu trong trình duyệt đổi được giữa ba mục mà URL gốc vẫn là `/docs/`. Không có Payment trong menu vì cổng chỉ mở webhook.

**Bước:** Mở `${BASE}/docs/` trong trình duyệt, chọn lần lượt ba service ở góc trên; kiểm tên và danh sách operation đổi theo service. Nếu một mục không tải hoặc menu không xuất hiện, giả thuyết “một UI dùng được” sai; kiểm config JSON và `swagger-initializer.js`.

**Nếu khác kỳ vọng:** Giả thuyết sai; dừng và kiểm config JSON cùng script khởi tạo UI.

#### TC-03 · Đặc tả trỏ Try it out về Gateway [dương]

**Kỳ vọng:** Ba JSON tại `/docs/identity.json`, `/docs/media.json` và `/docs/notification.json` đều trả 200, có `servers[0].url` lần lượt `/api/identity`, `/api/media`, `/api/notification`. Identity có `/v1/auth/providers`, Media có `/v1/media`, Notification có `/v1/inbox`; không có path `/healthz`, `/livez`, JWKS hoặc `/docs-json`.

**Bước:** Đọc `servers` và `paths` trong từng JSON; ở UI mở một operation và xem URL request. Nếu request dùng cổng riêng của service hoặc rời cùng origin, giả thuyết “Try it out qua Gateway” sai; kiểm bước sinh spec.

**Nếu khác kỳ vọng:** Giả thuyết sai; dừng và kiểm bước sinh spec.

#### TC-04 · API công khai và API cần đăng nhập giữ quyền [dương]

**Kỳ vọng:** Từ UI Identity, `GET /v1/auth/providers` trả 200. Từ UI Media, `GET /v1/media` khi chưa đăng nhập trả 401; sau khi nhập token hợp lệ của `P1`, request tới đúng `/api/media/v1/media` và trả theo quyền của `P1`. JSON mô tả được API quản trị và token dịch vụ, nhưng việc nhìn thấy operation không cấp quyền gọi.

**Bước:** Dùng nút `Try it out`, ghi request URL và status; nhập token thử vào nút Authorize rồi thử lại. Khi đổi service ở menu, chọn Authorize và nhập token lại cho spec vừa chọn. Nếu request bỏ qua Gateway hoặc request không token được 200, giả thuyết kiểm quyền sai; dừng nghiệm thu.

**Nếu khác kỳ vọng:** Giả thuyết sai; dừng nghiệm thu và kiểm xác thực của service.

#### TC-05 · Vai trò và tenant không bị UI bỏ qua [âm]

**Kỳ vọng:** Token `P1` gọi operation quản trị nền tảng trả 403; token chủ tiệm tự duyệt nội dung của tiệm mình trả 403. `A1` có quyền tương ứng xử lý được operation quản trị. Các bước phân quyền tương đương được chạy tự động trong `pnpm smoke:stack` hoặc `pnpm smoke:k8s`.

**Bước:** Dùng đúng token thử trong UI và đối chiếu status, mã lỗi từ service, request URL; không dán token vào biên bản. Nếu token thiếu quyền vẫn được 200, giả thuyết phân quyền sai; dừng và xem service guard.

**Nếu khác kỳ vọng:** Giả thuyết sai; dừng và soát quyền của token cùng guard service.

#### TC-06 · Đường nội bộ vẫn bị chặn [âm]

**Kỳ vọng:** Với Identity, Media và Notification, các đường nội bộ như `/api/identity/docs`, `/api/identity/docs-json`, `/api/identity/healthz` cùng đường tương ứng của hai service còn lại không trả nội dung Swagger hoặc health. Đường chứa `..` hoặc ký tự mã hoá cũng bị chặn. Bộ `pnpm test:gateway` kiểm các đường này.

**Bước:** Gọi trực tiếp các đường nội bộ qua Gateway và chạy `pnpm test:gateway`; đọc status và nội dung phản hồi.

**Nếu khác kỳ vọng:** Giả thuyết sai; dừng và kiểm route công khai cùng strip prefix.

Nếu một đường trả JSON nội bộ, giả thuyết “chỉ spec đã lọc được công bố” sai; kiểm route và strip prefix.

## 3. Kết quả đã ghi

| Ca    | Kết quả | Môi trường                | Quan sát                                                                                                                                                                               |
| ----- | ------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | Pass    | Compose gốc trên cổng thử | Năm URL docs và `/api/identity/docs-json` trả 404                                                                                                                                      |
| TC-01 | N/A     | Staging/production thật   | Chưa có môi trường để gọi HTTP                                                                                                                                                         |
| TC-02 | Pass    | k3d local và Compose dev  | UI, config và ba JSON trả 200; Chrome trên k3d chọn lần lượt ba service, hiện đúng tên và endpoint                                                                                     |
| TC-03 | Pass    | k3d local                 | Test e2e kiểm ba `servers`, path đại diện và cùng origin                                                                                                                               |
| TC-04 | Pass    | k3d local                 | Chrome gọi `/api/identity/v1/auth/providers` được 200; Media không token trả 401, sau Authorize bằng token player thì `/api/media/v1/media` trả 200 qua Gateway                        |
| TC-05 | Pass    | k3d local                 | Chrome dùng Authorize: token player gọi `/api/identity/v1/audit-logs` trả 403, token admin trả 200; cả hai request có Bearer qua Gateway. `pnpm smoke:k8s` kiểm thêm quyền theo tenant |
| TC-06 | Pass    | k3d local                 | Gateway test 12/12, đường nội bộ 404                                                                                                                                                   |

## 4. Diễn giải

| Quan sát                                                        | Kết luận                                                                 | Việc tiếp theo                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| TC-01 âm trả 404, TC-02/03 dương trả 200 và TC-04/05 giữ quyền  | Luồng dev đạt; tài liệu không xuất hiện trong cấu hình production đã thử | Chạy TC-01 trên staging thật khi có môi trường   |
| Ca âm trả 200 hoặc 502/504                                      | Không chứng minh được docs vắng mặt                                      | Dừng và kiểm route, pod cùng cấu hình môi trường |
| Ca dương trả 200 nhưng JSON thiếu path hoặc request rời Gateway | UI hiển thị nhưng hợp đồng FE sai                                        | Sửa bước sinh spec rồi chạy lại toàn bộ ca       |
| 401/403 không đúng quyền                                        | UI hoặc service tạo đường vượt quyền                                     | Dừng nghiệm thu, soát guard và token thử         |
