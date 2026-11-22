## Vấn đề

<!-- Điều gì đang sai hoặc còn thiếu, nói bằng lời thường. -->

## Thay đổi

<!-- Người dùng hoặc nhóm sẽ thấy khác gì. -->

## Truy vết

Closes #
REQ hoặc ADR:

## Cách kiểm

<!-- Đã kiểm gì và thấy gì, cả phần chưa kiểm được. -->

## Ảnh hưởng

<!-- Thứ tự triển khai, cấu hình mới, việc cần người khác làm. -->

## Tiêu chí và cách kiểm

- [ ] Đã đáp ứng các mục "Xong khi nào" của issue liên kết
- [ ] `pnpm verify` xanh ở local
- [ ] Việc này không lệch với REQ hoặc ADR đã chốt; nếu lệch, đã hỏi và ghi lại quyết định
- [ ] Đã cập nhật wiki, hợp đồng, trạng thái REQ nếu cần
- [ ] Việc chưa xong nằm sau cờ tính năng đã khai trong `docs/flags.yaml`; thay đổi schema và hợp đồng chạy được với bản liền trước
- [ ] Không có secret, mã số sinh viên, dữ liệu thật, hoặc mã chưa rõ nguồn gốc

Review là tùy chọn và không cần approval để merge. Góp ý review dùng `COMMENT`. Nếu `CHANGES_REQUESTED` chặn PR, người merge kiểm tra issue cùng pipeline rồi dismiss trạng thái đó khi đủ điều kiện.
