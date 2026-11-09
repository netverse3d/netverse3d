# ADR-0015: Tệp Blender là bản gốc của tài sản 3D

- Trạng thái: proposed
- Ngày: 2026-11-09

## Bối cảnh

[ADR-0014](./ADR-0014-saigon-cyber-and-own-characters.md) giao phần dựng 3D cho người làm được Blender, còn câu hỏi 16 để mở việc ai làm và có dùng công cụ sinh mô hình hay không.

Trong lúc thử ngoài repo, phần base của nhân vật được sinh bằng script điều khiển Blender. Người dẫn dắt nhóm đã xem qua nhiều vòng, chấp nhận kết quả và chọn tự dựng, không dùng Meshy hay Tripo cho phần base.

Script sinh không phải thứ cả nhóm sửa tiếp được: chỉnh tay trong Blender sẽ bị lần chạy sau ghi đè, và tệp `.blend` không gộp được như mã nguồn.

## Quyết định

**Nơi chứa**

- Thành phần mới `packages/game-assets` giữ toàn bộ tài sản 3D, cùng quy trình PR với mã.
- `.blend` và `.glb` lưu bằng Git LFS. CI thường không tải các tệp này; workflow `assets` tải khi PR chạm tới thành phần, workflow `docs` chỉ tải mô hình để xuất bản thư viện.
- `library/` là trang xem trực quan các thiết kế đã có, chạy tại máy và có bản trên trang tài liệu. Đây là bản phác để cả nhóm tham khảo, không phải mã sản phẩm.

**Bản gốc**

- Tệp `.blend` trong `source/` là bản gốc. Script sinh phần base chỉ chạy một lần và không vào repo. Từ đây mọi sửa đổi làm trong Blender.
- Tệp `.glb` trong `exported/` chỉ do lệnh xuất tạo ra.
- Mỗi nhóm việc một tệp: thân và xương, clip, tóc, phụ kiện, đồ vật. Trước khi sửa thì khoá tệp bằng Git LFS.

**Hợp đồng và kiểm tra**

- `assets.config.json` khai tên xương, clip, mesh và ngân sách tam giác.
- Lệnh xuất dừng và không ghi dấu xuất khi sai xương, thiếu clip, vượt ngân sách, còn modifier chưa apply hoặc vật liệu khác nhau giữa các tệp.
- `pnpm verify` chặn tệp gốc đã đổi mà chưa xuất lại, và tệp xuất không khớp dấu xuất.

**Nguồn gốc**

- Mô hình trong thành phần này là `provenance: original`: hình khối và chuyển động dựng mới cho dự án, không nhúng ảnh hay tài sản bên ngoài.
- Các tấm thiết kế dùng làm định hướng do người dẫn dắt nhóm tự tạo cho dự án, đã xác nhận ngày 2026-11-09. Chúng chưa cần vào repo nên chưa đưa vào.

**Biểu cảm**

- Sản phẩm có mười hai biểu cảm theo tấm thiết kế của người dẫn dắt, thay con số tám ở ADR-0014 và REQ-037.

## Hệ quả

- Thành viên chỉ cần học các thao tác Blender cơ bản là chỉnh được clip và đồ vật. Việc giữ bộ xương và nặn tóc cần một người chính (câu hỏi 16).
- Mỗi tệp chỉ một người sửa tại một thời điểm, vì không gộp được.
- Thành viên nào cũng cần Git LFS. Gói miễn phí của GitHub có 10 GiB lưu trữ và 10 GiB băng thông mỗi tháng.
- Áo, quần và giày vẫn nằm chung mesh `body`. Tách thành ô đồ theo ADR-0014 là việc của M1.
- Phần base có 24 hành động và 12 dáng biểu cảm.
- Khi `apps/web-3d` dùng các tệp này, bước build phải tải LFS hoặc lấy từ nơi phát hành riêng.

Liên quan: REQ-003, REQ-037, REQ-039, [ADR-0014](./ADR-0014-saigon-cyber-and-own-characters.md).
