# ADR-0007: Hai môi trường, phát hành bằng tag qua nút Release

- Trạng thái: accepted
- Ngày: 2026-11-07
- Xem thêm: [ADR-0022](./ADR-0022-per-component-release-tags.md) thay dạng tag chung bằng tag theo từng thành phần và đổi phạm vi so nội dung của tag production

## Bối cảnh

Nhóm cần một nơi test ổn định trước production. Merge và phát hành không được phụ thuộc vào một người cụ thể, nhưng ai làm cũng phải đúng quy trình.

## Quyết định

- `staging` là nhánh mặc định và môi trường test; `main` là production.
- PR việc squash vào `staging`. `staging` lên `main` bằng merge commit, vì squash làm git coi commit chưa vào `main` và gây xung đột ở vòng sau.
- Tag: `stg-vX.Y.Z` và `prod-vX.Y.Z`, một phiên bản chung cho cả hệ thống; CI chỉ build và deploy phần có thay đổi.
- Test lại trên staging thì tăng Z. Production dùng đúng số của bản staging đạt, nên số production có thể nhảy cóc.
- `prod-vX.Y.Z` chỉ hợp lệ khi nằm trên `main`, đã có `stg-vX.Y.Z` và cùng nội dung; dùng lại image đã test, không build lại.
- Tag không sửa, không xoá. Chỉ GitHub App của tổ chức tạo được tag, sau khi workflow Release kiểm tra và, với production, sau khi một thành viên khác duyệt.
- Hai App riêng cho hai loại tag, khoá nằm trong secret của Environment. Khoá production chỉ mở trên `main` và sau khi duyệt, vì workflow chạy từ file trên chính nhánh được chọn nên secret cấp repo có thể bị đọc từ một nhánh bất kỳ.
- Check bắt buộc phải do GitHub Actions tạo, để không giả được bằng cách gửi status cùng tên.
- Không tìm thấy image đúng nội dung thì phát hành thất bại, không dùng tạm image cũ hơn.
- Ai có quyền ghi cũng bấm được Release. Không ai bỏ qua được quy trình, kể cả admin.

## Hệ quả

- Việc chưa xong trong `staging` phải ẩn sau feature flag, vì promote mang theo toàn bộ.
- Không có luồng riêng cho sửa gấp. Sửa gấp là một `fix`, cũng lên `staging` rồi mới tới production, nên không cần nhánh `hotfix/*` và không có merge từ `main` về `staging`.
- Khi tổ chức mới có một người, tạm để 0 approval và cho tự duyệt; có thành viên thì bật lại.
- Chủ tổ chức vẫn sửa được cấu hình trong trường hợp khẩn cấp, nên việc này được ghi lại trong audit log.
