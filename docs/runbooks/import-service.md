# Quy trình nhận service có sẵn

Dùng khi một service được chuẩn bị ở repo riêng rồi đưa vào monorepo. Chạy lần lượt, bước nào đỏ thì dừng ở đó.

## 1. Xác nhận quyền dùng mã

Bước này phải xong trước mọi bước khác.

- Mã do nhóm tự viết mới cho dự án: ghi `provenance: original`.
- Mã có nguồn từ dự án hoặc tổ chức khác: cần phép bằng văn bản của bên sở hữu. Thêm ADR ghi ai cho phép, phạm vi và nơi lưu bằng chứng, rồi ghi `provenance: cleared` và `provenance_ref`.
- Không có phép: không đưa mã vào. Viết mới từ yêu cầu của dự án.

Kết quả mong đợi: `component.yaml` có giá trị nguồn gốc đúng sự thật.

## 2. Làm sạch ở repo độc lập

- Bỏ mọi phụ thuộc vào hệ thống khác: tên miền, tenant, dữ liệu mẫu, cấu hình hạ tầng.
- Đạt [chuẩn thành phần](../wiki/engineering/component-standard.md).
- Chạy được một mình bằng Docker Compose.

## 3. Soát trước khi đưa vào

Chạy trong repo độc lập:

```
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.30.1 git /repo --redact --no-banner --exit-code 1
```

Kết quả mong đợi: exit code 0. Có phát hiện thì xoay vòng secret đó, không chỉ xoá khỏi mã.

## 4. Đưa vào monorepo, không mang lịch sử git

Lịch sử cũ có thể chứa secret hoặc thông tin không được công khai, nên chỉ nhập bản chụp hiện tại:

```
git switch staging && git pull
git switch -c feat/<issue>-import-<id>
git -C <repo-độc-lập> archive HEAD | tar -x -C services/<id>
```

Giữ lại `README.md` và cập nhật `component.yaml` của thành phần trong monorepo.

## 5. Khớp với monorepo

- Đổi tên package thành `@netverse/<id>`.
- Đưa hợp đồng dùng chung vào `packages/contracts`.
- Thêm cấu hình vào `infra/compose` nếu cần dịch vụ mới.
- Cập nhật mục trong `docs/catalog.yaml` và `README.md` của thành phần.

## 6. Kiểm tra

```
pnpm install
pnpm catalog:check
pnpm verify
```

Kết quả mong đợi: tất cả exit code 0.

## 7. Mở PR

- PR vào `staging`, mô tả có `Closes #<issue>` và REQ hoặc ADR.
- Nêu rõ service đến từ đâu và đã bỏ những gì.
- PR này lớn hơn bình thường; chỉ gồm việc nhập và khớp, không trộn thêm tính năng mới.
