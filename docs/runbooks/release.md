# Quy trình phát hành

Ai có quyền ghi vào repo cũng làm được. Không tạo tag bằng tay.

Mỗi lần phát hành là cho một thành phần. Tag có dạng `<id>/stg-vX.Y.Z` và `<id>/prod-vX.Y.Z`, với `<id>` là mã thành phần trong `docs/catalog.yaml`. Xem [nhánh và phát hành](../wiki/engineering/branching-and-release.md).

Hệ thống chỉ từ chối tag tạo tay sau khi đã có [GitHub App](./github-app.md). Trước thời điểm đó chưa có lớp chặn này, nên không mời thêm người có quyền ghi.

## Phát hành staging

1. Mở tab **Actions**, chọn workflow **release**, bấm **Run workflow**.
2. Chọn nhánh `staging`.
3. Nhập mã thành phần như `identity`, chọn môi trường `staging`, nhập phiên bản như `0.1.0`.
4. Bấm chạy.

Kết quả mong đợi: tag `identity/stg-v0.1.0` xuất hiện, workflow **build-staging** chạy cho riêng `identity` và xanh. Image là `ghcr.io/<tổ chức>/identity:0.1.0`.

Lỗi thường gặp:

| Thông báo                             | Cách xử lý                                        |
| ------------------------------------- | ------------------------------------------------- |
| `Component is required`               | Nhập mã thành phần                                |
| `is not a deployable component`       | Sai mã, hoặc thành phần chưa có `Dockerfile`      |
| `Version must look like 1.4.0`        | Nhập đúng định dạng số                            |
| `must be on staging`                  | Chạy workflow trên đúng nhánh                     |
| `already exists`                      | Tag không dùng lại được, tăng số                  |
| `must be greater than`                | Số phải lớn hơn bản trước của chính thành phần đó |
| `Required check "verify" has not run` | Chờ CI của commit đó chạy xong rồi chạy lại       |

## Đưa lên production

1. Test trên staging đạt.
2. Mở PR `staging` vào `main`. Một thành viên khác duyệt, merge bằng **Create a merge commit**.
3. Mở **Actions** → **release** → **Run workflow**, chọn nhánh `main`, nhập đúng mã thành phần, môi trường `production` và đúng phiên bản của bản staging đã đạt.
4. Workflow dừng ở bước chờ duyệt. Một thành viên khác mở lần chạy và bấm **Review deployments**.

Kết quả mong đợi: tag `identity/prod-v0.1.0` xuất hiện, workflow **deploy-production** gắn thêm tag `prod-v0.1.0` lên đúng image `identity:0.1.0` đã test, không build lại.

Lỗi thường gặp:

| Thông báo                               | Cách xử lý                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `must be on main`                       | Chạy workflow trên `main`                                                                                  |
| `stg-v… does not exist`                 | Phát hành staging cho thành phần đó trước                                                                  |
| `content of <id> differs from …/stg-v…` | Thành phần, package nó phụ thuộc hoặc tệp gốc dùng chung đã đổi sau bản staging; phát hành staging bản mới |

Thay đổi của thành phần khác trên `main` không gây lỗi này.

## Xem thành phần nào đang ở phiên bản nào

```
git fetch --tags
pnpm release:state
```

Lệnh in một bảng: mỗi thành phần triển khai được một dòng, kèm bản mới nhất đã phát hành ở staging và ở production. Bảng này cũng hiện ở phần tóm tắt của mỗi lần chạy **build-staging** và **deploy-production**. Mã trên `main` có thể mới hơn bản đang chạy của một thành phần, nên lấy bảng này làm căn cứ, không suy từ nhánh.

## Tìm thành phần có lỗi

1. Trên PR: tên job đỏ trong CI là tên thành phần hỏng.
2. Trên môi trường đang chạy: log của mỗi service có tên service và phiên bản; health trả phiên bản đang chạy.
3. Xem tag mới nhất của thành phần đó: `git tag --list '<id>/*' --sort=-creatordate`.

## Khi bản production của một thành phần có lỗi

Không sửa hay xoá tag.

- Sửa tiếp: một nhánh `fix/*` bình thường, phát hành staging rồi production cho riêng thành phần đó với số mới.
- Lùi về bản trước: bản trước vẫn còn nguyên image `<id>:<số cũ>`. Việc trỏ môi trường về image đó sẽ có lệnh riêng lúc có hạ tầng triển khai; hiện chưa có server nên chưa có bước này.

Các thành phần khác không bị đụng tới trong cả hai cách.

## Khi build staging lỗi

Workflow **build-staging** chỉ build thành phần của tag. Nếu build lỗi vì sự cố tạm thời, trước lúc image được đẩy lên, thì chạy lại chính lần chạy đó bằng **Re-run failed jobs**. Nếu image của số đó đã có thì workflow từ chối build đè, để bản đã test không bị thay; lúc đó sửa và phát hành số mới.

## Hiện trạng

Chưa có server, nên hai workflow mới build và kiểm tra image; bước deploy thật sẽ thêm khi có hạ tầng. Chưa có tag nào được phát hành.
