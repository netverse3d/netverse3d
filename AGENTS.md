# Quy tắc làm việc trong Netverse 3D

Áp dụng cho mọi người và mọi công cụ AI làm việc trong repo này. Chi tiết nằm trong `docs/wiki`.

## Đọc gì trước khi sửa

1. `docs/wiki/product/overview.md` và `docs/wiki/engineering/architecture.md`: tổng quan nghiệp vụ và kỹ thuật.
2. `docs/requirements/registry.yaml`: yêu cầu đã thống nhất.
3. `docs/decisions/`: các quyết định kiến trúc và phạm vi (ADR).
4. `docs/catalog.yaml` và `README.md` của thành phần sắp sửa.

## Khi có dấu hiệu lệch nghiệp vụ: dừng và hỏi

Lệch nghĩa là việc được yêu cầu trái với một REQ hoặc ADR, hoặc chưa có REQ nào phủ.

1. Dừng sửa mã.
2. Hỏi người đang làm, nêu rõ REQ hoặc ADR liên quan và các lựa chọn kèm hệ quả. Công cụ có hộp thoại hỏi thì dùng hộp thoại.
3. Ghi kết quả vào `docs/requirements/registry.yaml` hoặc thêm ADR mới trong `docs/decisions/`.
4. Liên kết nhánh với yêu cầu: `pnpm trace:link REQ-001`.

Không tự chọn thay người đang làm, không tự sửa REQ hoặc ADR để hợp với mã.

## Luồng làm việc

- Mọi việc bắt đầu từ một issue có gắn REQ.
- Nhánh tách từ `staging`: `feat/<issue>-<slug>`, `fix/<issue>-<slug>`, `docs/<slug>`, `chore/<slug>`.
- PR vào `staging` bằng squash. Mô tả PR có `Closes #<issue>` và REQ hoặc ADR.
- `staging` lên `main` bằng merge commit, không squash.
- Sửa gấp cũng là một `fix`, đi qua `staging` như mọi việc khác.
- Phát hành chỉ qua workflow Release. Không tạo tag bằng tay.
- Không ai đẩy thẳng lên `staging` hoặc `main`.

## Quy ước mã

- Tên định danh và chuỗi trong mã bằng tiếng Anh. Tài liệu, mô tả PR, tên ca test bằng tiếng Việt có dấu.
- Commit theo Conventional Commits bằng tiếng Anh, chỉ có tiêu đề và trailer, không có thân văn xuôi. Ví dụ: `feat: let owners rent land`, trailer `Refs: REQ-001`.
- Không thêm chú thích mới. Khi sửa một hàm hoặc khai báo, xoá chú thích cũ trong đơn vị đó. Chỉ giữ chỉ dẫn cho công cụ như build tag, lint directive, migration marker, shebang.
- Kiến thức để trong tên định danh, tên test, `docs/wiki`, ADR.
- Tìm mã có sẵn trước khi viết mới.

## Repo public: những điều cấm

- Không commit secret, mã số sinh viên, dữ liệu thật của người dùng.
- Không đưa mã, tài liệu từ dự án hoặc tổ chức khác vào repo nếu chưa có phép rõ ràng và chưa khai `provenance` trong `component.yaml`.
- Không chép nguyên văn nội dung riêng của mentor. Chỉ giữ bản tóm tắt ở `docs/sources`.

## Kiểm tra trước khi mở PR

```
pnpm verify
```

Không tắt hoặc nới công cụ kiểm để cho qua. Báo cáo đúng cả phần đỏ và phần bỏ qua.
