# Nghiệm thu API Gateway và Kubernetes local

Kết quả đo trên Compose, cụm k3d local và CI ngày 16/11/2026 cho [REQ-047](../requirements/registry.yaml) và [REQ-048](../requirements/registry.yaml). Cách dựng lại môi trường nằm ở [runbook cổng vào](./gateway.md) và [runbook Kubernetes local](./k8s-local.md).

## Đã đạt

| Kiểm tra                                    | Cách làm                                                      | Kết quả đo                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đường API và đường nội bộ trên Compose      | Chạy bộ nghiệm thu cổng trên `http://127.0.0.1:58080`         | 12/12 ca đạt; API được chuyển đúng service, đường health/docs/metric nội bộ không lộ ra cổng                                                                    |
| IP client và audit                          | Gửi `X-Forwarded-For` giả rồi đối chiếu phản hồi và audit     | Header do client gửi bị loại; service nhận IP qua một proxy tin cậy                                                                                             |
| Hạn mức và kích thước body                  | Gửi 40 yêu cầu auth song song, sau đó gửi body 2 MiB          | 30 phản hồi `429` với `Retry-After: 2`; yêu cầu sau 60 giây nhận `200`; body quá mức nhận `413`                                                                 |
| Web và WebSocket thử nghiệm                 | Mở trang web, kiểm header, kết nối `/ws/_probe`               | Web trả `200` với `DENY`, `nosniff` và chính sách referrer; WebSocket nâng cấp `101` và trả lời ping                                                            |
| Luồng xuyên service trên Compose            | Chạy `pnpm smoke:stack`                                       | `STACK SMOKE PASSED`; upload/download qua cổng storage và sự kiện Kafka đạt                                                                                     |
| Cụm local và manifest                       | Chạy `pnpm k8s:up`, `pnpm k8s:check`                          | Cụm sẵn sàng tại `http://127.0.0.1:58180/`; platform 91, local 60, staging 39 manifest hợp lệ; invalid, errors, skipped và lỗi policy đều bằng 0                |
| Cổng và luồng xuyên service trên Kubernetes | Chạy `pnpm test:gateway`, `pnpm smoke:k8s`                    | Bộ kiểm cổng 11/11 đạt; smoke kết thúc `STACK SMOKE PASSED` sau khi hạn mức auth hồi phục                                                                       |
| Cô lập mạng và dữ liệu                      | Chạy `pnpm test:k8s`, thử bỏ rồi áp lại NetworkPolicy         | 2/2 ca đạt: pod ngoài namespace không gọi được identity, pod cùng namespace gọi được; role identity bị từ chối ở database khác và đọc được 2 migration của mình |
| Kafka và tự hồi phục                        | Kiểm topic, sự kiện; khởi động lại pod identity và PostgreSQL | Topic identity/notification và sự kiện smoke có mặt; lúc thay pod thấy `502`/`503` rồi `200`; migration không chạy lại, đăng nhập thành công                    |
| Giao diện trong trình duyệt                 | Mở `http://127.0.0.1:58180/` bằng Chrome                      | Người dùng xác nhận giao diện ổn; HTTP trả `200` cùng các header bảo vệ                                                                                         |
| CI trên PR #363                             | Xem run `43852781751` của workflow Kubernetes                 | Job `render` thành công trong 39 giây; job `cluster` thành công trong 11 phút 3 giây                                                                            |
| Cấu hình sinh lại từ nguồn                  | Đổi route trên PR thử #364 mà không render                    | Job `render` báo `gateway config is stale`; PR thử đã đóng                                                                                                      |

## Chưa kiểm chứng được

| Kiểm tra              | Đang chờ                         | Cách kiểm khi có                                                                          |
| --------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| TLS với tên miền thật | Chứng chỉ và tên miền triển khai | Gọi web, API, webhook và storage qua HTTPS; kiểm chứng chỉ và chuyển hướng                |
| Triển khai staging    | Môi trường staging               | Triển khai image và manifest staging, chạy lại smoke và kiểm chính sách mạng              |
| Triển khai production | Quy trình phát hành production   | Chạy nghiệm thu sau phát hành với cấu hình và dữ liệu production được phép dùng           |
| WebSocket game        | Game Gateway và Room Server thật | Bật `/ws/game`, kết nối nhiều client và kiểm xác thực, giới hạn cùng hành vi ngắt kết nối |
