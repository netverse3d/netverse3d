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
git -C <repo-độc-lập> archive <commit> | tar -x -C services/<id>
```

Giữ lại `README.md` và cập nhật `component.yaml` của thành phần trong monorepo.

## 5. Khớp với monorepo

Làm theo thứ tự, mỗi nhóm một PR. `services/media` là ví dụ đã đi hết các bước này.

### 5.1. Bỏ cấu hình công cụ riêng

Xoá khỏi bản nhập: giấy phép riêng, workflow CI, cấu hình lint và định dạng, lockfile của trình quản lý gói khác, `.npmrc`, `.gitattributes`, `.gitignore`, `.dockerignore`, tệp Compose riêng. Các thứ này đã có một bản ở gốc repo, theo [chuẩn thành phần](../wiki/engineering/component-standard.md).

### 5.2. Chạy được dưới pnpm

- Đổi tên package thành `@netverse/<id>`.
- `tsconfig.json` kế thừa `tsconfig.base.json`. Cấu hình gốc chặt hơn, nên sửa các chỗ nó báo lỗi thay vì tắt luật.
- Script của package theo quy ước của repo: `lint` là kiểm kiểu, `test` là unit test không cần hạ tầng, `build` ra `dist`, `test:e2e` là test cần database.
- Gói nào cần chạy script lúc cài thì ghi rõ cho phép hoặc từ chối trong `allowBuilds` của `pnpm-workspace.yaml`.
- Prisma: không ghim `output` của generator vào `node_modules` của service, để client được sinh đúng chỗ pnpm tìm.
- Bản build không dùng biên dịch tăng dần. Tệp trạng thái biên dịch cũ kết hợp với việc xoá `dist` trước mỗi lần build làm bản build thiếu tệp mà không báo lỗi.

### 5.3. Vào lint và CI chung

- Lint gốc phủ `services/`. Mã service không dùng `any`, không đọc `process.env` ngoài phần cấu hình, không dùng Prisma client ngoài repository.
- Thành phần có script `test:e2e` thì CI tự bật PostgreSQL và chạy script đó. Script phải tự áp migration.

### 5.4. Image

- `Dockerfile` dựng từ gốc repo bằng pnpm, chỉ chép tệp gốc cần thiết, thư mục của service và các package nó phụ thuộc.
- Trường `files` trong `package.json` giới hạn thứ vào image: phần đã biên dịch và tệp cơ sở dữ liệu.
- Sinh Prisma client trong image sau bước đóng gói. Chạy bằng người dùng không phải root. Kiểm sức khoẻ bằng `/livez`.

### 5.5. Hợp đồng và hạ tầng

- Tài liệu API sinh theo OpenAPI 3.1; bản công bố nằm ở `packages/contracts/openapi/v1/<id>.yaml` và có test buộc nó trùng với bản service sinh ra.
- Sự kiện gửi ra theo vỏ chung `events/v1/envelope`; phần `data` có hợp đồng riêng trong `packages/contracts/events/v1`.
- Dịch vụ hạ tầng mới thêm vào `infra/compose` và vào danh sách của `pnpm infra:smoke`. Service chạy dưới profile `apps`.
- Có một runbook chạy thử service trên hạ tầng dev, như [chạy thử media service](./media-smoke.md).

### 5.6. Sổ sách

- `component.yaml` ghi đúng nguồn gốc; `README.md` theo mẫu của repo.
- Cập nhật mục trong `docs/catalog.yaml`.

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
