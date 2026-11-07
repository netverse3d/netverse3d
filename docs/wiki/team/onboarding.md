# Ngày đầu tiên

## 1. Cài công cụ

| Công cụ        | Phiên bản | Ghi chú                       |
| -------------- | --------- | ----------------------------- |
| Git            | Mới nhất  |                               |
| Node.js        | 22.14     | Xem `.nvmrc`                  |
| pnpm           | 11        | `npm i -g pnpm`               |
| Docker Desktop | Mới nhất  | Để chạy hạ tầng dev           |
| Go, Python     | Khi cần   | Chỉ khi làm game core hoặc AI |

## 2. Lấy mã và chuẩn bị

```
git clone https://github.com/netverse3d/netverse3d.git
cd netverse3d
pnpm bootstrap
pnpm infra:smoke
pnpm verify
```

Kết quả mong đợi: `pnpm infra:smoke` báo `Infrastructure healthy`, `pnpm verify` kết thúc không lỗi. Xong việc thì tắt hạ tầng bằng `pnpm infra:down`.

`pnpm bootstrap` tạo `.env` từ `.env.example`, cài thư viện và bật git hook.

## 3. Đọc theo thứ tự

1. [Tổng quan sản phẩm](../product/overview.md)
2. [Luồng nghiệp vụ](../product/business-flows.md)
3. [Thuật ngữ](../product/glossary.md)
4. [Kiến trúc](../engineering/architecture.md)
5. [Luồng làm việc](./workflow.md)
6. [Quy ước](../engineering/conventions.md)
7. [Sổ quyết định](../../decisions/index.md)

## 4. Nhận việc đầu tiên

1. Mở Project của nhóm, chọn một issue đã sẵn sàng và tự gán.
2. Làm theo [luồng làm việc](./workflow.md).

## Dùng công cụ AI

Công cụ nào cũng được. Tệp quy tắc chung ở gốc repo được các công cụ phổ biến tự đọc. Yêu cầu công cụ của bạn tuân theo tệp đó, nhất là phần dừng và hỏi khi lệch nghiệp vụ.
