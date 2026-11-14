# ADR-0032: Không dùng Dependabot, nâng thư viện có chủ đích

- Trạng thái: accepted
- Ngày: 2026-11-15
- Xem thêm: [ADR-0009](./ADR-0009-traceability-and-drift.md)

## Bối cảnh

Dependabot mở mỗi tuần một PR gom mọi thư viện, gồm cả các bản nâng lớn có thay đổi phá vỡ như TypeScript 7, NestJS 12, `jose` 6, `protobufjs` 8. Hai PR liên tiếp đều đỏ ở bộ kiểm và không merge được, nên các bản vá nhỏ cũng bị kẹt theo. Nhóm không cần một nguồn PR tự động chưa từng merge được.

## Quyết định

1. Gỡ cấu hình Dependabot khỏi repo và tắt việc Dependabot tự mở PR vá bảo mật.
2. Bỏ ngoại lệ miễn gắn yêu cầu dành cho PR của Dependabot ở bước kiểm truy vết. Ngoại lệ còn lại là PR đưa `staging` lên `main`, như ADR-0009.
3. Thư viện được nâng có chủ đích: mỗi lần nâng là một issue, một nhánh `chore/`, đi qua bộ kiểm đầy đủ như mọi thay đổi khác. Bản nâng lớn được làm riêng từng thư viện.

## Hệ quả

- Không còn PR tự động; lỗ hổng mới chỉ được thấy khi có người xem danh sách cảnh báo bảo mật của GitHub hoặc chạy `pnpm audit`.
- Cảnh báo bảo mật hiện có vẫn được theo dõi qua issue, ví dụ #340 cho thư viện máy khách S3 của media.
