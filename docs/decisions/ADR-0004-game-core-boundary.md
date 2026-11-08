# ADR-0004: Game core do mentor làm ở repo riêng, nhóm kế thừa sau

- Trạng thái: accepted
- Ngày: 2026-11-07
- Xem thêm: room server giả chỉ để test giao diện ở [ADR-0013](./ADR-0013-vertical-slice-roadmap.md)

## Bối cảnh

Mentor sẽ tự triển khai phần core realtime trong repo riêng. Sơ đồ ghi Room Server bằng Go, còn bản demo dùng Colyseus trên Node, nên chưa biết ngôn ngữ cuối cùng và thời điểm bàn giao.

## Quyết định

- `services/game` chỉ giữ chỗ cho tới khi có core.
- Ranh giới là giao thức trong `packages/contracts/realtime`. Bản hiện tại là nháp và có thể đổi khi có core.
- Nhóm không tự viết game server trong thời gian chờ.

## Hệ quả

- Giao diện 3D có thể làm trước với dữ liệu giả theo giao thức nháp.
- Các REQ về realtime chưa thể nghiệm thu cho tới khi có core.
- Khi nhận core, cần đi qua quy trình nhận service và cập nhật ADR này.
