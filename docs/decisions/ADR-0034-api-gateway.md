# ADR-0034: Cổng vào duy nhất bằng Traefik, định tuyến theo /api/<service>

- Trạng thái: accepted
- Ngày: 2026-11-15
- Xem thêm: [ADR-0003](./ADR-0003-seven-services.md), [ADR-0020](./ADR-0020-monorepo-layout-and-index.md), [ADR-0028](./ADR-0028-service-to-service-communication.md), [ADR-0035](./ADR-0035-kubernetes-platform.md)

## Bối cảnh

Sơ đồ kiến trúc có lớp cổng vào cho client, nhưng `infra/gateway` mới chỉ giữ chỗ. Client phải gọi thẳng từng service theo cổng riêng. Bốn service đã chạy cùng có `/v1/audit-logs`, `/healthz` và `/livez`, nên không chuyển nguyên đường dẫn qua một cổng được. Service đọc IP của client để giới hạn tần suất và ghi kiểm toán, nhưng mặc định không tin proxy nào.

## Quyết định

1. Cổng vào là Traefik v3. Cùng một sản phẩm chạy trong Compose bằng provider file và trên Kubernetes theo Gateway API. Không dùng provider Docker, vì provider này cần quyền vào Docker socket.
2. Client gọi API theo `/api/<service>/v<n>/…`. Cổng cắt `/api/<service>` rồi chuyển phần còn lại cho service, nên đường dẫn bên trong service và hợp đồng OpenAPI giữ nguyên. Ứng dụng web nằm ở `/` cùng origin, nên client không cần CORS. WebSocket đi qua `/ws/…`.
3. Cổng không xác thực và không chứa nghiệp vụ. Mỗi service tự kiểm token như hiện nay. Cổng chỉ làm bốn việc:
   - chặn đường nội bộ;
   - giới hạn tần suất theo IP;
   - giới hạn cỡ yêu cầu;
   - thay X-Forwarded-For do client gửi bằng IP cổng thấy.
4. Chỉ đường `/api/<service>/v<n>` mới ra ngoài. `/healthz`, `/livez`, `/docs`, metric và khoá công khai của identity chỉ dùng trong mạng nội bộ.
5. Payment chỉ mở đường webhook của nhà cung cấp. Các đường dùng API key và đường quản trị nội bộ không đi qua cổng, vì trình duyệt không được giữ API key và màn quản trị payment chưa có.
6. Object storage đi qua một entrypoint riêng, không cắt tiền tố và giữ nguyên `Host`, vì URL ký sẵn ký cả host lẫn đường dẫn.
7. Route khai một lần ở `infra/gateway/routes.yaml`. Cấu hình của Compose và Kubernetes được sinh từ tệp đó, bước kiểm báo khi tệp sinh lệch nguồn.
8. Hạn mức ban đầu:
   - đường API: trung bình 100 yêu cầu mỗi giây, burst 200, mỗi IP;
   - đường xác thực của identity: trung bình 30 yêu cầu mỗi phút, burst 10, mỗi IP;
   - body tối đa 1 MiB, khớp giới hạn của service.
9. Service chạy sau cổng đặt `TRUST_PROXY_HOPS=1` để IP trong kiểm toán và trong hạn mức là IP của client.
10. Route WebSocket của game khai sẵn nhưng tắt cho tới khi có game server. Một route thử WebSocket chỉ có ở Compose và ở cụm local để kiểm việc nâng cấp kết nối.

## Hệ quả

- URL công khai của API đổi sang `/api/<service>/v1/…`. Kịch bản kiểm xuyên service và client sau này gọi qua cổng.
- Swagger của service chỉ xem được ở cổng riêng của service khi chạy local.
- Webhook của nhà cung cấp thanh toán phải đăng ký URL `/api/payment/v1/webhooks/<provider>`.
- Service chạy sau cổng mà quên `TRUST_PROXY_HOPS=1` thì mọi client dùng chung một hạn mức; bước kiểm cấu hình cổng chặn trường hợp này trong Compose.
- Hạn mức của cổng tính theo từng bản Traefik. Khi chạy nhiều bản, hạn mức thực tế nhân theo số bản.
- Traefik không tự sinh request id; service vẫn sinh, và access log của cổng ghi request id trong phản hồi.
- WebSocket của game chờ game server theo [ADR-0004](./ADR-0004-game-core-boundary.md).
