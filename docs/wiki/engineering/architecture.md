# Kiến trúc

Theo [ADR-0003](../../decisions/ADR-0003-seven-services.md). Các ô nét đứt chưa có hoặc chưa chốt.

```mermaid
flowchart TB
  subgraph Clients
    W[Web 3D và PWA]
    AD[Admin]
  end
  subgraph Edge
    GW[API Gateway]
    WS[WebSocket Gateway]
  end
  subgraph Realtime
    GG[Game Gateway]:::pending
    RS[Room Server]:::pending
  end
  subgraph Services
    ID[identity]
    CO[shop]
    WO[world]
    ME[media]
    PA[payment]
    AI[ai-chat]
    NO[notification]
  end
  subgraph Platform
    K[Kafka]
    R[Redis]
    WK[Workers]
    PG[PostgreSQL]
    S3[Object storage chuẩn S3]:::pending
  end
  W --> GW
  AD --> GW
  W --> WS
  WS --> GG --> RS
  GW --> ID & CO & WO & ME & PA & AI & NO
  RS --> CO & WO
  ID & CO & WO & ME & PA & NO --> PG
  ME --> S3
  ID & CO & WO & ME & PA & AI & NO --> K
  CO & WO & RS --> R
  K --> WK
  classDef pending stroke-dasharray: 5 5
```

## Vai trò từng phần

Xem [danh sách thành phần](./components.md).

## Giao tiếp

| Kiểu                 | Dùng cho                                            | Khai ở đâu                    |
| -------------------- | --------------------------------------------------- | ----------------------------- |
| HTTP qua API Gateway | Client gọi service                                  | `packages/contracts/openapi`  |
| WebSocket            | Gameplay realtime                                   | `packages/contracts/realtime` |
| gRPC                 | Service gọi đồng bộ với nhau, chỉ khi thật cần      | `packages/contracts`          |
| Kafka                | Sự kiện và việc nền, cách mặc định giữa các service | `packages/contracts/events`   |

## Quy tắc kiến trúc

- Mỗi service sở hữu cơ sở dữ liệu của mình. Không đọc thẳng bảng của service khác.
- Tiền và quyền sử dụng chỉ đổi sau khi webhook được xác thực, và xử lý phải an toàn khi lặp lại.
- Game server có thẩm quyền: client chỉ gửi ý định, server quyết định trạng thái.
- Dữ liệu cá nhân chỉ nằm ở service cần nó.

## Hạ tầng dev

`pnpm infra:up` chạy PostgreSQL, Redis, Kafka, Prometheus, Grafana, Loki và OpenTelemetry Collector bằng Docker Compose. Object storage chưa có, xem [câu hỏi mở](../open-questions.md).

| Dịch vụ    | Địa chỉ mặc định                                   |
| ---------- | -------------------------------------------------- |
| PostgreSQL | `localhost:55432`                                  |
| Redis      | `localhost:56379`                                  |
| Kafka      | `localhost:59092`                                  |
| Grafana    | `http://localhost:53000`                           |
| Prometheus | `http://localhost:59090`                           |
| OTLP       | `localhost:54317` (gRPC), `localhost:54318` (HTTP) |
