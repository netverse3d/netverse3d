# ADR-0006: Wiki nằm trong repo

- Trạng thái: accepted
- Ngày: 2026-11-07

## Bối cảnh

Nhóm cần một wiki cập nhật liên tục, theo sát mã và công cụ AI đọc được. GitHub Wiki là repo tách riêng, không đi qua PR và CI.

## Quyết định

Nguồn duy nhất là `docs/`. Trang wiki được build bằng VitePress và đăng lên GitHub Pages mỗi khi `staging` đổi.

## Hệ quả

- Thay đổi tài liệu đi qua PR và review như mã; link chết làm CI đỏ.
- Sổ yêu cầu và danh sách ADR trên trang được sinh từ dữ liệu, không sửa tay.
