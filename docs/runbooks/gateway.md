# Vận hành cổng vào

Dùng khi thêm hoặc đổi đường API, khi client nhận lỗi lạ qua cổng, hoặc khi đổi hạn mức. Quyết định nền ở [ADR-0034](../decisions/ADR-0034-api-gateway.md).

## 1. Cổng làm gì

Mọi yêu cầu từ client đi qua Traefik:

- API ở `/api/<service>/v1/…`. Cổng cắt `/api/<service>` rồi chuyển phần còn lại cho service.
- Ứng dụng web ở `/`.
- WebSocket ở `/ws/…`.
- Object storage ở một cổng riêng, giữ nguyên `Host` để URL ký sẵn còn đúng chữ ký.
- Swagger UI ở `/docs` trong Compose dev và Kubernetes local, dùng cùng origin với API.

Cổng chặn đường nội bộ, giới hạn tần suất theo IP, giới hạn body 1 MiB và bỏ `X-Forwarded-For` do client tự gửi. Cổng **không** kiểm token: mỗi service tự xác thực.

| Môi trường       | Cổng web                 | Cổng storage             |
| ---------------- | ------------------------ | ------------------------ |
| Compose          | `http://127.0.0.1:58080` | `http://127.0.0.1:58334` |
| Kubernetes local | `http://127.0.0.1:58180` | `http://127.0.0.1:58335` |

## 2. Bảng route

Nguồn duy nhất là `infra/gateway/routes.yaml`.

| Đường                        | Service        | Chính sách                        |
| ---------------------------- | -------------- | --------------------------------- |
| `/api/identity/v1/auth/…`    | identity       | `rate-auth`, `body-1m`            |
| `/api/identity/v1/…`         | identity       | `rate-api`, `body-1m`             |
| `/api/media/v1/…`            | media          | `rate-api`, `body-1m`             |
| `/api/notification/v1/…`     | notification   | `rate-api`, `body-1m`             |
| `/api/payment/v1/webhooks/…` | payment        | `rate-api`, `body-1m`             |
| `/docs` chỉ ở dev            | api-docs       | `rate-api`, `web-headers`         |
| `/`                          | web-3d         | `rate-api`, `web-headers`         |
| `/` ở cổng storage           | object storage | không                             |
| `/ws/_probe/…`               | gateway-probe  | chỉ Compose và cụm local, để kiểm |

Payment chỉ mở đường webhook. `/healthz`, `/livez`, `/docs-json`, metric và khoá công khai của identity ở từng service không ra ngoài cổng. Staging và production cũng không có `/docs` tập trung.

## 3. Thêm hoặc đổi route

1. Sửa `infra/gateway/routes.yaml`.
2. `pnpm gateway:render` để sinh lại `infra/gateway/compose/dynamic.yaml`, `dynamic-dev.yaml` và các tệp trong `infra/k8s`.
3. `pnpm gateway:check`. Kết quả mong đợi: `Gateway config matches infra/gateway/routes.yaml.`
4. Dựng Compose như [kịch bản chạy thử](./stack-smoke.md) rồi `GATEWAY_WS_PROBE=1 pnpm test:gateway`. Kết quả mong đợi: không ca nào đỏ.
5. Commit cả tệp nguồn lẫn tệp sinh. Không sửa tay tệp sinh: `pnpm gateway:check` sẽ báo `stale`.

Route API phải có dạng `/api/<service>/v<n>` và `strip` là `/api/<service>`, nếu không `gateway:check` từ chối.

## 4. Xem và thử API trong dev

Chạy Compose theo [kịch bản stack](./stack-smoke.md) với cả `compose.yaml` và `compose.dev.yaml`, hoặc chạy cụm theo [kịch bản Kubernetes local](./k8s-local.md). Mở `http://127.0.0.1:58080/docs/` trên Compose, hoặc `http://127.0.0.1:58180/docs/` trên k3d. Menu phía trên chọn Identity, Media hoặc Notification; Payment hiện chỉ có webhook nên không xuất hiện.

Mỗi service sở hữu hợp đồng OpenAPI trong `packages/contracts/openapi/v1`. `pnpm api-docs:render` sinh bản hiển thị trong `infra/gateway/docs` từ hợp đồng và route công khai; `pnpm api-docs:check` báo khi bản này cũ. Đường `servers` của từng bản là `/api/<service>`, nên `Try it out` gọi qua Gateway trên cùng origin. UI không cấp thêm quyền: API cần token vẫn trả 401 khi chưa đăng nhập; token thiếu vai trò hoặc tenant vẫn trả 403. Các operation quản trị và token dịch vụ có thể nhìn thấy trong spec vì cũng nằm trên route công khai; FE chỉ gọi chúng khi luồng sản phẩm và quyền cho phép.

Compose gốc dùng `dynamic.yaml` và không khởi động `api-docs`. Chỉ tệp ghép dev mới gắn `dynamic-dev.yaml` và container UI. Kubernetes chỉ ghép component `api-docs` trong overlay local; staging không có Deployment, Service, HTTPRoute hay JSON tài liệu và đặt `SWAGGER_ENABLED=false` cho service. Xem [kịch bản nghiệm thu](./acceptance-gateway-api-docs.md) để kiểm hai chiều.

## 5. Chạy service sau cổng

Service sau cổng đặt `TRUST_PROXY_HOPS=1`. Thiếu biến này thì service thấy mọi yêu cầu đến từ IP của cổng: mọi client dùng chung một hạn mức và audit ghi sai IP. `pnpm gateway:check` báo `<service> must set TRUST_PROXY_HOPS=1 behind the gateway` nếu một service trong Compose thiếu biến này.

Chạy service trực tiếp, không có cổng, thì giữ `TRUST_PROXY_HOPS=0` như trong `.env.example` của service.

## 6. Đọc access log

```
docker compose --env-file .env.example -f infra/compose/compose.yaml --profile apps logs gateway | grep '"RequestPath":"/api/identity'
```

Mỗi dòng là một JSON. Các trường cần xem:

| Trường                    | Ý nghĩa                                         |
| ------------------------- | ----------------------------------------------- |
| `RouterName`              | Route đã khớp, rỗng nếu không route nào khớp    |
| `DownstreamStatus`        | Mã trả cho client                               |
| `OriginStatus`            | Mã service trả cho cổng, `0` nếu không tới được |
| `request_X-Request-Id`    | Request id client gửi, nếu có                   |
| `downstream_X-Request-Id` | Request id service trả, dùng để tìm log service |

Header `Authorization` và `Cookie` không bao giờ được ghi.

## 7. Chẩn đoán theo mã lỗi

| Thấy                           | Nghĩa là                                 | Làm gì                                            |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------- |
| `404`, không có `x-request-id` | Không route nào của cổng khớp            | Xem bảng route; đường có đúng `/api/<service>/v1` |
| `404`, có `x-request-id`       | Tới service nhưng service không có route | Xem OpenAPI của service                           |
| `413`                          | Body vượt 1 MiB ở cổng                   | Tải tệp lớn qua URL ký sẵn của media              |
| `429`, không có `x-request-id` | Hạn mức của cổng                         | Chờ theo `Retry-After`, hoặc xem mục 8            |
| `429`, có `x-request-id`       | Throttle của service                     | Xem cấu hình `RATE_LIMIT_*` của service           |
| `502`                          | Cổng không kết nối được service          | `docker compose … ps`; service có `healthy` không |
| `503`                          | Không bản nào của service sẵn sàng       | Xem readiness của service                         |
| `504`                          | Service không trả header trong 30 giây   | Xem log service theo request id                   |

## 8. Đổi hạn mức

Sửa mục `policies` trong `infra/gateway/routes.yaml`, rồi làm như mục 3. Hạn mức tính theo từng bản Traefik; chạy nhiều bản thì hạn mức thực tế nhân theo số bản.

## 9. Xem metric

```
docker compose --env-file .env.example -f infra/compose/compose.yaml --profile apps exec gateway wget -qO- http://127.0.0.1:8082/metrics | grep traefik_router_requests_total
```

Cổng `8082` chỉ mở bên trong mạng Docker, không ra ngoài.
