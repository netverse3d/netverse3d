# Vận hành cổng vào

Dùng khi thêm hoặc đổi đường API, khi client nhận lỗi lạ qua cổng, hoặc khi đổi hạn mức. Quyết định nền ở [ADR-0034](../decisions/ADR-0034-api-gateway.md).

## 1. Cổng làm gì

Mọi yêu cầu từ client đi qua Traefik:

- API ở `/api/<service>/v1/…`. Cổng cắt `/api/<service>` rồi chuyển phần còn lại cho service.
- Ứng dụng web ở `/`.
- WebSocket ở `/ws/…`.
- Object storage ở một cổng riêng, giữ nguyên `Host` để URL ký sẵn còn đúng chữ ký.

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
| `/`                          | web-3d         | `rate-api`, `web-headers`         |
| `/` ở cổng storage           | object storage | không                             |
| `/ws/_probe/…`               | gateway-probe  | chỉ Compose và cụm local, để kiểm |

Payment chỉ mở đường webhook. `/healthz`, `/livez`, `/docs`, metric và khoá công khai của identity không ra ngoài cổng.

## 3. Thêm hoặc đổi route

1. Sửa `infra/gateway/routes.yaml`.
2. `pnpm gateway:render` để sinh lại `infra/gateway/compose/dynamic.yaml` và các tệp trong `infra/k8s`.
3. `pnpm gateway:check`. Kết quả mong đợi: `Gateway config matches infra/gateway/routes.yaml.`
4. Dựng Compose như [kịch bản chạy thử](./stack-smoke.md) rồi `GATEWAY_WS_PROBE=1 pnpm test:gateway`. Kết quả mong đợi: không ca nào đỏ.
5. Commit cả tệp nguồn lẫn tệp sinh. Không sửa tay tệp sinh: `pnpm gateway:check` sẽ báo `stale`.

Route API phải có dạng `/api/<service>/v<n>` và `strip` là `/api/<service>`, nếu không `gateway:check` từ chối.

## 4. Chạy service sau cổng

Service sau cổng đặt `TRUST_PROXY_HOPS=1`. Thiếu biến này thì service thấy mọi yêu cầu đến từ IP của cổng: mọi client dùng chung một hạn mức và audit ghi sai IP. `pnpm gateway:check` báo `<service> must set TRUST_PROXY_HOPS=1 behind the gateway` nếu một service trong Compose thiếu biến này.

Chạy service trực tiếp, không có cổng, thì giữ `TRUST_PROXY_HOPS=0` như trong `.env.example` của service.

## 5. Đọc access log

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

## 6. Chẩn đoán theo mã lỗi

| Thấy                           | Nghĩa là                                 | Làm gì                                            |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------- |
| `404`, không có `x-request-id` | Không route nào của cổng khớp            | Xem bảng route; đường có đúng `/api/<service>/v1` |
| `404`, có `x-request-id`       | Tới service nhưng service không có route | Xem OpenAPI của service                           |
| `413`                          | Body vượt 1 MiB ở cổng                   | Tải tệp lớn qua URL ký sẵn của media              |
| `429`, không có `x-request-id` | Hạn mức của cổng                         | Chờ theo `Retry-After`, hoặc xem mục 7            |
| `429`, có `x-request-id`       | Throttle của service                     | Xem cấu hình `RATE_LIMIT_*` của service           |
| `502`                          | Cổng không kết nối được service          | `docker compose … ps`; service có `healthy` không |
| `503`                          | Không bản nào của service sẵn sàng       | Xem readiness của service                         |
| `504`                          | Service không trả header trong 30 giây   | Xem log service theo request id                   |

## 7. Đổi hạn mức

Sửa mục `policies` trong `infra/gateway/routes.yaml`, rồi làm như mục 3. Hạn mức tính theo từng bản Traefik; chạy nhiều bản thì hạn mức thực tế nhân theo số bản.

## 8. Xem metric

```
docker compose --env-file .env.example -f infra/compose/compose.yaml --profile apps exec gateway wget -qO- http://127.0.0.1:8082/metrics | grep traefik_router_requests_total
```

Cổng `8082` chỉ mở bên trong mạng Docker, không ra ngoài.
