# payment

Service: cổng thanh toán PayOS, VietQR và VNPay; quản lý intent, attempt, webhook, hoàn tiền và đối soát.

- Stack: NestJS, Prisma, PostgreSQL
- Milestone: M3
- Trạng thái: đã nhập gateway, dùng `packages/nest-kit`; nghiệp vụ Xèng và MachineLicense chưa triển khai
- Nguồn mã: ADR-0031

Service tiếp nhận callback nhà cung cấp, xác minh chữ ký, ghi trạng thái giao dịch và phát outbox. Mỗi service dùng database riêng; không lưu credential thật trong repository.

URL webhook tenant phải dùng HTTPS trên cổng 443 và trỏ tới địa chỉ IP công khai. Worker phân giải rồi ghim IP khi kết nối, không theo redirect. Tạo hoặc xoay secret webhook cần `PROVIDER_CREDENTIALS_KEYS`; giá trị secret chỉ trả một lần và được mã hóa trong database.

## Kiểm tra

```
pnpm --filter @netverse/payment lint
pnpm --filter @netverse/payment test
pnpm --filter @netverse/payment build
pnpm --filter @netverse/payment prisma:validate
```

Test đầu cuối áp migration trước khi chạy:

```
DATABASE_URL=postgresql://... pnpm --filter @netverse/payment test:e2e
```

Cấu hình service nằm trong `.env.example`. API công bố theo OpenAPI tại `openapi.yaml`; các hợp đồng Netverse sẽ được quản lý trong `packages/contracts`.
