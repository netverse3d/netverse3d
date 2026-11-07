# Nhánh và phát hành

Theo [ADR-0007](../../decisions/ADR-0007-branching-and-release.md).

```mermaid
gitGraph
  commit id: "khởi tạo"
  branch staging
  branch feat/12-login
  commit id: "wip"
  commit id: "review"
  checkout staging
  commit id: "feat: login (#12)" tag: "stg-v0.1.0"
  commit id: "fix: payment (#13)" tag: "stg-v0.1.1"
  checkout main
  merge staging tag: "prod-v0.1.1"
```

## Hai môi trường

|                 | Staging                          | Production                                                    |
| --------------- | -------------------------------- | ------------------------------------------------------------- |
| Nhánh           | `staging`, là nhánh mặc định     | `main`                                                        |
| Tag             | `stg-vX.Y.Z`                     | `prod-vX.Y.Z`                                                 |
| Ý nghĩa         | Bản đưa ra test                  | Bản chính thức, đúng số của bản staging đã đạt                |
| Khi phát hành   | Build image của phần có thay đổi | Thành viên khác duyệt rồi mới tạo tag, dùng lại image đã test |
| Dữ liệu, secret | Riêng cho test                   | Thật, tách hoàn toàn                                          |

## Đưa thay đổi vào

| Từ                                     | Vào       | Cách merge                   |
| -------------------------------------- | --------- | ---------------------------- |
| `feat/*`, `fix/*`, `docs/*`, `chore/*` | `staging` | Squash                       |
| `staging`                              | `main`    | Merge commit                 |
| `hotfix/*`                             | `main`    | Merge commit                 |
| `main`                                 | `staging` | Merge commit, sau mỗi hotfix |

Không squash khi đưa `staging` lên `main`: git sẽ coi commit chưa vào `main` và gây xung đột ở vòng sau.

Sau khi merge thì xoá nhánh; việc tiếp theo tạo nhánh mới từ `staging`. Làm tiếp trên nhánh đã squash sẽ gây xung đột.

Promote mang theo mọi thứ đang có trong `staging`, nên việc chưa xong phải ẩn sau feature flag.

## Số phiên bản

Cả hệ thống dùng chung một số phiên bản. CI chỉ build và deploy phần có thay đổi.

- `fix` tăng Z, `feat` tăng Y, thay đổi phá vỡ tăng X.
- Bắt đầu từ `0.1.0`, `1.0.0` dành cho lần ra mắt thật.
- Test lại trên staging thì tăng Z. Production lấy đúng số của bản đạt, nên số production có thể nhảy cóc:

```
stg-v0.1.0   test thấy lỗi thanh toán
stg-v0.1.1   đã sửa, test thấy lỗi đăng nhập
stg-v0.1.2   đã sửa, test đạt
prod-v0.1.2  lên production
```

## Phát hành

Ai có quyền ghi cũng phát hành được, và không ai bỏ qua được các bước kiểm, kể cả admin. Làm theo [quy trình phát hành](../../runbooks/release.md).

## Hotfix

1. Tách `hotfix/<phiên-bản>-<slug>` từ `main`, sửa và test.
2. Phát hành staging trên nhánh hotfix để test.
3. PR vào `main`.
4. Phát hành production.
5. PR `main` vào `staging`, bằng merge commit.
