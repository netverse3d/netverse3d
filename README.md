# Netverse 3D

Nền tảng thế giới tiệm net 3D đa người chơi trên web. Chủ tiệm thuê đất, xây và vận hành tiệm; người chơi chọn tiệm, vào máy và giao lưu.

Đồ án của nhóm Đỗ Hoàng Gia Bảo, Lê Nguyễn Minh Kha, Nguyễn Thành Danh, Nguyễn Hoàng An, mentor Trương Long.

## Bắt đầu

```
pnpm bootstrap
pnpm infra:smoke
pnpm verify
```

Xem [ngày đầu tiên](docs/wiki/team/onboarding.md).

## Tài liệu

| Muốn biết              | Đọc                                                                      |
| ---------------------- | ------------------------------------------------------------------------ |
| Sản phẩm là gì         | [Tổng quan sản phẩm](docs/wiki/product/overview.md)                      |
| Nghiệp vụ chạy thế nào | [Luồng nghiệp vụ](docs/wiki/product/business-flows.md)                   |
| Hệ thống gồm những gì  | [Kiến trúc](docs/wiki/engineering/architecture.md)                       |
| Làm việc thế nào       | [Luồng làm việc](docs/wiki/team/workflow.md)                             |
| Đã thống nhất những gì | [Yêu cầu](docs/requirements/registry.yaml), [quyết định](docs/decisions) |
| Còn gì chưa chốt       | [Câu hỏi mở](docs/wiki/open-questions.md)                                |

## Cấu trúc

```
apps/       web-3d, admin
services/   identity, shop, world, media, payment, ai-chat, notification, game
workers/    asset, ai, jobs
packages/   contracts, game-shared, game-assets, ui, config
docs/       wiki, requirements, decisions, runbooks, sources
infra/      compose
scripts/    bootstrap, kiểm tra truy vết, phát hành
```

## Giấy phép

Mã nguồn được công khai để xem, không cấp phép sử dụng lại. Xem [LICENSE](LICENSE).
