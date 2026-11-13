# ADR-0020: Bố cục monorepo, chỉ mục toàn repo và cách giữ chuẩn chung giữa các service

- Trạng thái: accepted
- Ngày: 2026-11-12
- Xem thêm: [ADR-0001](./ADR-0001-monorepo.md), [ADR-0003](./ADR-0003-seven-services.md), [ADR-0004](./ADR-0004-game-core-boundary.md), [ADR-0008](./ADR-0008-media-replaces-asset.md)

## Bối cảnh

Ngày 2026-11-07 mentor đưa lên repo riêng một bản backend mẫu chạy được ở local, tóm tắt ở nguồn `mentor-backend-sample` trong [nguồn của yêu cầu](../sources/README.md). Bản đó khác monorepo của nhóm ở ba điểm:

- Bốn ứng dụng thay vì bảy service: một ứng dụng nghiệp vụ gộp tài khoản, tiệm, máy, bố cục thế giới và asset; một ứng dụng thanh toán; game server viết bằng Go; một ứng dụng AI viết bằng Python.
- Hợp đồng đặt phiên bản theo thư mục, có một cổng vào duy nhất, có thư mục test chạy trên cả hệ và script vận hành. Luật về thay đổi phá vỡ ở dòng này đã được thay bằng [ADR-0029](./ADR-0029-contract-checks-ensure-consistency.md).
- Các ứng dụng dùng chung một cơ sở dữ liệu và một khoá ký token; tài liệu của bản mẫu tự ghi đây là nợ phải trả trước khi chạy thật.

Phía nhóm, `docs/catalog.yaml` mới chỉ khai `apps`, `services`, `workers`, `packages`. Các thư mục `infra`, `scripts`, `docs` không có trong chỉ mục nào, và repo chưa có chỗ cho test xuyên thành phần hay cổng vào. Nhóm cũng đã chuẩn bị sẵn một số service NestJS ở repo riêng theo [quy trình nhận service](../runbooks/import-service.md), mỗi service tự mang một bản chép của cùng phần mã khung.

Hai câu hỏi phát sinh khi đưa các service đó vào một repo: phần cấu hình và mã khung giống nhau để ở đâu, và chuẩn chung giữ thế nào khi game server viết bằng Go, AI viết bằng Python.

Người dẫn dắt nhóm chốt các điểm dưới đây ngày 2026-11-12, theo [REQ-044](../requirements/registry.yaml).

## Quyết định

### 1. Giữ bảy service

Số service và ranh giới theo [ADR-0003](./ADR-0003-seven-services.md) không đổi; chỉ `core-api` đổi tên thành `shop` ở mục 3. Nhóm không gộp service theo bản mẫu. Bảng dưới chỉ để đối chiếu khi đọc bản mẫu hoặc khi nhận mã theo [ADR-0004](./ADR-0004-game-core-boundary.md).

| Thành phần của nhóm     | Phần tương ứng trong bản mẫu của mentor                     |
| ----------------------- | ----------------------------------------------------------- |
| `services/identity`     | Đăng ký, đăng nhập, token, vai trò trong ứng dụng nghiệp vụ |
| `services/shop`         | Tiệm, máy, quyền dùng máy, trang tổng quan quản trị         |
| `services/world`        | Bố cục tiệm bản nháp và bản phát hành, vé vào phòng         |
| `services/media`        | Tải lên bằng URL ký sẵn, duyệt asset, danh mục asset        |
| `services/payment`      | Ứng dụng thanh toán và tiến trình chuyển sự kiện thanh toán |
| `services/ai-chat`      | Ứng dụng AI                                                 |
| `services/notification` | Chưa có                                                     |
| `services/game`         | Game server                                                 |
| `packages/contracts`    | Thư mục hợp đồng                                            |
| `infra/gateway`         | Cổng vào                                                    |

### 2. Vai trò của thư mục cấp cao

| Thư mục     | Chứa gì                                                               |
| ----------- | --------------------------------------------------------------------- |
| `apps/`     | Giao diện chạy trên trình duyệt                                       |
| `services/` | Tiến trình phục vụ API hoặc kết nối realtime, mỗi service một thư mục |
| `workers/`  | Tiến trình xử lý việc nền                                             |
| `packages/` | Mã và dữ liệu dùng chung, không tự triển khai                         |
| `infra/`    | Hạ tầng chạy hệ thống: Compose, cổng vào, cấu hình quan sát           |
| `tests/`    | Kiểm chạy trên nhiều thành phần cùng lúc: kiểm chuẩn, đầu cuối, tải   |
| `scripts/`  | Công cụ của repo: kiểm, sinh tài liệu, phát hành                      |
| `docs/`     | Yêu cầu, quyết định, wiki, runbook                                    |

Backend không nằm trong `apps/`. Test của riêng một thành phần ở trong thành phần đó; `tests/` chỉ dành cho kiểm cần nhiều thành phần cùng chạy.

### 3. Đặt tên

- Tên thư mục viết thường, nối bằng gạch ngang, bằng tiếng Anh.
- Tên service là tên miền nghiệp vụ, không kèm hậu tố `-api`, `-service`, `-server`. `services/core-api` đổi tên thành `services/shop`, vì miền của nó là tiệm: tiệm, máy, thuê đất, giờ máy và điểm doanh thu. Tên bảy service là `identity`, `shop`, `world`, `media`, `payment`, `ai-chat`, `notification`.
- Tên package là `@netverse/<id>`, với `<id>` trùng mã trong catalog.
- Hợp đồng đặt phiên bản theo thư mục: `packages/contracts/<loại>/v<N>/<tên>`. Thay đổi phá vỡ mở thư mục phiên bản mới, bản cũ giữ cho tới khi hết bên dùng.

### 4. Chỉ mục toàn repo sinh từ catalog

`docs/catalog.yaml` là nơi khai duy nhất cho mọi thư mục cấp cao và mọi thành phần. Trang chỉ mục của từng thư mục cấp cao và bảng tổng trong wiki được sinh từ đó. Công cụ kiểm đỏ khi có thư mục cấp cao chưa khai hoặc trang chỉ mục lệch với catalog.

### 5. Monorepo là bản gốc sau khi nhập

Mỗi service chuẩn bị ở repo riêng được nhập một lần theo [quy trình nhận service](../runbooks/import-service.md). Từ lúc đó mọi thay đổi diễn ra trong monorepo, repo riêng không nhận thêm thay đổi và không được nhập lại.

### 6. Độc lập lúc chạy, không độc lập về mã nguồn

Một service độc lập khi nó có cơ sở dữ liệu riêng, cấu hình riêng, image riêng và chỉ nói chuyện với service khác qua `packages/contracts`. Việc mỗi service giữ một bản chép của cùng phần mã khung không làm nó độc lập hơn. Cấu hình chia ba lớp:

| Lớp                | Ví dụ                                                                   | Để ở đâu                                  |
| ------------------ | ----------------------------------------------------------------------- | ----------------------------------------- |
| Công cụ phát triển | Lint, định dạng, cấu hình TypeScript gốc, lockfile, workflow            | Gốc repo, một bản                         |
| Cấu hình lúc chạy  | `.env.example`, khai biến môi trường, `Dockerfile`, schema dữ liệu, API | Trong từng thành phần                     |
| Hạ tầng local      | PostgreSQL, Redis, Kafka, object storage                                | `infra/compose`, mỗi service một database |

### 7. Chuẩn chung giữ bằng ba tầng

| Tầng                | Nội dung                                                                       | Để ở đâu                     | Phụ thuộc ngôn ngữ |
| ------------------- | ------------------------------------------------------------------------------ | ---------------------------- | ------------------ |
| Chuẩn trên dây      | Hình response, lỗi, phân trang, health, nội dung token, vỏ sự kiện, trường log | `packages/contracts` và wiki | Không              |
| Kiểm chuẩn          | Bộ kiểm gọi HTTP thật vào service đang chạy và đối chiếu với chuẩn trên dây    | `tests/conformance`          | Không              |
| Bộ khung theo stack | Mã dùng chung của các service cùng một stack; trước mắt chỉ có bộ cho NestJS   | `packages/nest-kit`          | Có                 |

- Service viết bằng ngôn ngữ khác tự viết phần khung của mình và phải qua cùng bộ kiểm chuẩn.
- Bộ khung cho một ngôn ngữ chỉ được lập khi có service thứ hai dùng ngôn ngữ đó.
- Chuẩn áp theo loại giao tiếp. Service HTTP chịu toàn bộ. Service realtime chỉ chịu phần health, token, log và sự kiện.

## Hệ quả

- Catalog, công cụ kiểm catalog và công cụ sinh tài liệu phải mở rộng để phủ `infra`, `tests`, `scripts`, `docs`.
- Hợp đồng đang đặt phiên bản bằng hậu tố tên tệp phải dời vào thư mục phiên bản; bên dùng đổi đường dẫn theo.
- Các repo riêng của service không còn là nơi phát triển tiếp sau khi nhập.
- Bộ kiểm chuẩn hiện có ở các repo riêng chạy trong tiến trình của NestJS, nên phải tách phần gọi qua HTTP ra `tests/conformance` trước khi áp cho service Go và Python.
- Nhận mã từ bản mẫu của mentor vẫn phải qua quy trình nhận service và khai nguồn gốc theo [ADR-0005](./ADR-0005-public-repository.md). Quyết định này không đưa mã nào của mentor vào repo.
- Khác biệt về mô hình tiền, cơ sở dữ liệu dùng chung và khoá ký token giữa bản mẫu và thiết kế của nhóm không thuộc quyết định này.
