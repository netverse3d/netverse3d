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
| Endpoint `/healthz`                                   |     | Có      |        |         |
| Khai nguồn gốc trong `component.yaml`                 | Có  | Có      | Có     | Có      |

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
provenance_ref: ADR-0010
```

## Quy ước chung cho service

- Tên package: `@netverse/<id>`.
- Mỗi service có cơ sở dữ liệu riêng, không đọc bảng của service khác.
- Service chỉ nói chuyện với nhau qua `packages/contracts`: HTTP, gRPC hoặc sự kiện Kafka.
- Cấu hình qua biến môi trường, không có giá trị thật trong `.env.example`.
- Log có cấu trúc, xuất metric và trace theo OpenTelemetry.
- Không phụ thuộc vào ngữ cảnh của hệ thống khác: tên miền, tenant, dữ liệu mẫu đều phải thuộc Netverse 3D.

Đưa một service có sẵn vào repo thì làm theo [quy trình nhận service](../../runbooks/import-service.md).
