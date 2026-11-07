# ADR-0001: Dùng một monorepo cho toàn bộ dự án

- Trạng thái: accepted
- Ngày: 2026-11-07

## Bối cảnh

Dự án có nhiều stack: Next.js, NestJS, Python, và game server chưa chốt ngôn ngữ. Bốn người cần cùng thấy được từ nghiệp vụ đến mã.

## Quyết định

Mọi tài liệu, hợp đồng, mã và hạ tầng nằm trong `netverse3d/netverse3d`. TypeScript dùng pnpm workspace và Turborepo; Go và Python thêm công cụ riêng khi có mã.

## Hệ quả

- Một PR có thể đổi đồng thời hợp đồng và các bên dùng hợp đồng.
- CI phải chỉ chạy phần có thay đổi để không chậm dần.
- Service chuẩn bị ở repo riêng phải đi qua quy trình nhận service.
