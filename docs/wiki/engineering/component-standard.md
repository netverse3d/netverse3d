# Chuẩn thành phần

Mọi thành phần trong `apps/`, `services/`, `workers/`, `packages/` đều được khai trong `docs/catalog.yaml`. Lệnh `pnpm catalog:check` kiểm các điều dưới đây, và CI chặn PR nếu sai.

## Khi mới giữ chỗ

Thư mục chỉ cần `README.md` và `component.yaml`:

```yaml
provenance: none
```

## Khi đã có mã

| Yêu cầu                                               | App | Service | Worker | Package |
| ----------------------------------------------------- | --- | ------- | ------ | ------- |
| Manifest (`package.json`, `go.mod`, `pyproject.toml`) | Có  | Có      | Có     | Có      |
| Có tệp test                                           | Có  | Có      | Có     | Có      |
| `Dockerfile`                                          | Có  | Có      | Có     |         |
| `.env.example`                                        |     | Có      | Có     |         |
| `openapi.yaml`                                        |     | Có      |        |         |
| Endpoint `/livez` và `/healthz`                       |     | Có      |        |         |
| Khai nguồn gốc trong `component.yaml`                 | Có  | Có      | Có     | Có      |

## Health

Service có hai endpoint, theo hợp đồng `packages/contracts/openapi/v1/health.yaml`:

| Endpoint   | Trả lời câu hỏi                    | Kiểm phụ thuộc | Ai gọi                                                   |
| ---------- | ---------------------------------- | -------------- | -------------------------------------------------------- |
| `/livez`   | Tiến trình còn sống không          | Không          | Nền tảng chạy, để quyết định khởi động lại               |
| `/healthz` | Service đã sẵn sàng nhận việc chưa | Có             | Cổng vào và nền tảng chạy, để quyết định gửi yêu cầu tới |

Hai endpoint không cần đăng nhập và không ghi log truy cập. `/healthz` trả 503 lúc một phụ thuộc bắt buộc như cơ sở dữ liệu đang lỗi.

## Nguồn gốc mã

Repo công khai, nên mọi mã phải rõ nguồn gốc trước khi vào repo.

| Giá trị `provenance` | Nghĩa                          | Điều kiện                                                                  |
| -------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `none`               | Chưa có mã                     | Không được có mã trong thư mục                                             |
| `original`           | Nhóm tự viết mới cho dự án này | Không chép từ dự án hoặc tổ chức khác                                      |
| `cleared`            | Có nguồn ngoài và đã được phép | `provenance_ref` trỏ tới một ADR ghi rõ ai cho phép, phạm vi và bằng chứng |

Đổi tên biến hay xoá tên tổ chức trong mã không làm thay đổi quyền sở hữu. Không chắc thì hỏi người phụ trách trước khi đưa mã vào.

```yaml
provenance: cleared
provenance_ref: ADR-9999
```

## Quy ước chung cho service

- Tên package: `@netverse/<id>`.
- Mỗi service có cơ sở dữ liệu riêng, không đọc bảng của service khác.
- Service chỉ nói chuyện với nhau qua `packages/contracts`: HTTP, gRPC hoặc sự kiện Kafka.
- Cấu hình qua biến môi trường, không có giá trị thật trong `.env.example`.
- Log có cấu trúc, xuất metric và trace theo OpenTelemetry.
- Không phụ thuộc vào ngữ cảnh của hệ thống khác: tên miền, tenant, dữ liệu mẫu đều phải thuộc Netverse 3D.

Đưa một service có sẵn vào repo thì làm theo [quy trình nhận service](../../runbooks/import-service.md).
