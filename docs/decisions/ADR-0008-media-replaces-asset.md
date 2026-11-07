# ADR-0008: Media service đảm nhận luôn phần Asset

- Trạng thái: accepted
- Ngày: 2026-11-07

## Bối cảnh

Sơ đồ của mentor có Asset Service cho GLB, texture, metadata, MinIO và CDN. Nhóm cũng cần xử lý ảnh và âm thanh người dùng tải lên.

## Quyết định

Gộp cả hai vào `services/media`. Tổng số service vẫn là 7. Khi đối chiếu với sơ đồ, Asset Service tương ứng với media.

## Hệ quả

- Service này phân biệt rõ asset của hệ thống và nội dung người dùng, vì quy tắc kiểm duyệt khác nhau.
- Nếu về sau tải quá khác nhau, việc tách ra phải bằng một ADR mới.
