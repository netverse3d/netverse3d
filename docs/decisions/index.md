# Sổ quyết định

Trang này được sinh từ các tệp ADR trong `docs/decisions`.

| Mã | Quyết định | Trạng thái |
| --- | --- | --- |
| [ADR-0001](./ADR-0001-monorepo.md) | Dùng một monorepo cho toàn bộ dự án | Đã chốt |
| [ADR-0002](./ADR-0002-product-scope.md) | Tiệm net là sản phẩm chính, AI làm sau | Đã chốt |
| [ADR-0003](./ADR-0003-seven-services.md) | Dựng theo kiến trúc 7 service | Đã chốt |
| [ADR-0004](./ADR-0004-game-core-boundary.md) | Game core do mentor làm ở repo riêng, nhóm kế thừa sau | Đã chốt |
| [ADR-0005](./ADR-0005-public-repository.md) | Repo công khai, giữ bản quyền, kiểm soát nguồn gốc mã | Đã chốt |
| [ADR-0006](./ADR-0006-docs-as-wiki.md) | Wiki nằm trong repo | Đã chốt |
| [ADR-0007](./ADR-0007-branching-and-release.md) | Hai môi trường, phát hành bằng tag qua nút Release | Đã chốt |
| [ADR-0008](./ADR-0008-media-replaces-asset.md) | Media service đảm nhận luôn phần Asset | Đã chốt |
| [ADR-0009](./ADR-0009-traceability-and-drift.md) | Truy vết yêu cầu và hỏi lại khi lệch | Đã chốt |
| [ADR-0010](./ADR-0010-one-way-virtual-currency.md) | Tiền ảo nạp một chiều, chủ tiệm nhận điểm doanh thu riêng | Đề xuất |
| [ADR-0011](./ADR-0011-station-screens.md) | Màn hình máy là lớp 2D, màn hình chung đồng bộ bằng trạng thái | Đề xuất |
| [ADR-0012](./ADR-0012-games-for-rl-bots.md) | Game trên máy do nhóm làm, bot học tăng cường chơi cùng người | Đề xuất |
| [ADR-0013](./ADR-0013-vertical-slice-roadmap.md) | Lộ trình theo lát cắt chạy được, room server giả trong lúc chờ core | Đã chốt |
| [ADR-0014](./ADR-0014-saigon-cyber-and-own-characters.md) | Bối cảnh Sài Gòn cyber, nhân vật và bot do nhóm tự thiết kế | Đề xuất |
| [ADR-0015](./ADR-0015-blender-sources-as-master.md) | Tệp Blender là bản gốc của tài sản 3D | Đã chốt |
| [ADR-0016](./ADR-0016-shop-identity-as-data.md) | Bản sắc tiệm là dữ liệu, mô hình không mang màu cố định | Đã chốt |
| [ADR-0017](./ADR-0017-web-client-layers.md) | Client game chia lớp, cảnh 3D và giao diện chỉ gặp nhau ở kho trạng thái | Đã chốt |
| [ADR-0018](./ADR-0018-script-generated-asset-sources.md) | Mô hình bàn máy và phòng có bản gốc là script trong repo | Đã chốt |
| [ADR-0019](./ADR-0019-registered-parts-and-one-render-standard.md) | Thế giới chỉ lắp từ thành phần đã đăng ký và dùng chung một chuẩn dựng hình | Đã chốt |
| [ADR-0020](./ADR-0020-monorepo-layout-and-index.md) | Bố cục monorepo, chỉ mục toàn repo và cách giữ chuẩn chung giữa các service | Đã chốt |
| [ADR-0021](./ADR-0021-two-real-money-flows.md) | Hai dòng tiền thật: người chơi nạp Xèng, chủ tiệm mua license máy | Đã chốt |
| [ADR-0022](./ADR-0022-per-component-release-tags.md) | Phát hành theo từng thành phần, mỗi thành phần một dòng tag | Đã chốt |
| [ADR-0023](./ADR-0023-media-service-origin-and-object-storage.md) | Nguồn gốc mã của media service và object storage ở môi trường dev | Đã chốt |
| [ADR-0024](./ADR-0024-identity-origin-and-shop-tenants.md) | Nguồn gốc mã của identity service và mỗi tiệm là một tenant | Đã chốt |
| [ADR-0025](./ADR-0025-media-access-by-tenant-model.md) | Quyền trên media theo mô hình tenant, duyệt nội dung là quyền nền tảng | Đã chốt |
| [ADR-0026](./ADR-0026-public-shop-media-and-tenant-creation.md) | Tệp công khai của tiệm mở cho mọi tài khoản, và service shop tạo tenant lúc mở tiệm | Đã chốt |
| [ADR-0027](./ADR-0027-notification-service-origin-and-channels.md) | Nguồn gốc mã của notification service và ba kênh thông báo | Đã chốt |
