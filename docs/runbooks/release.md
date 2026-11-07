# Quy trình phát hành

Ai có quyền ghi vào repo cũng làm được. Không tạo tag bằng tay.

Hệ thống chỉ từ chối tag tạo tay sau khi đã có [GitHub App](./github-app.md). Trước thời điểm đó chưa có lớp chặn này, nên không mời thêm người có quyền ghi.

## Phát hành staging

1. Mở tab **Actions**, chọn workflow **release**, bấm **Run workflow**.
2. Chọn nhánh `staging`.
3. Chọn môi trường `staging`, nhập phiên bản như `0.1.0`.
4. Bấm chạy.

Kết quả mong đợi: tag `stg-v0.1.0` xuất hiện, workflow **build-staging** chạy và xanh.

Lỗi thường gặp:

| Thông báo                      | Cách xử lý                       |
| ------------------------------ | -------------------------------- |
| `Version must look like 1.4.0` | Nhập đúng định dạng số           |
| `stg-v… must be on staging`    | Chạy workflow trên đúng nhánh    |
| `already exists`               | Tag không dùng lại được, tăng số |

## Đưa lên production

1. Test trên staging đạt.
2. Mở PR `staging` vào `main`. Một thành viên khác duyệt, merge bằng **Create a merge commit**.
3. Mở **Actions** → **release** → **Run workflow**, chọn nhánh `main`, môi trường `production`, nhập đúng phiên bản của bản staging đã đạt.
4. Workflow dừng ở bước chờ duyệt. Một thành viên khác mở lần chạy và bấm **Review deployments**.

Kết quả mong đợi: tag `prod-v…` xuất hiện, workflow **deploy-production** chạy bằng image đã test.

Lỗi thường gặp:

| Thông báo                     | Cách xử lý                                              |
| ----------------------------- | ------------------------------------------------------- |
| `prod-v… must be on main`     | Chạy workflow trên `main`                               |
| `stg-v… does not exist`       | Phát hành staging trước                                 |
| `content differs from stg-v…` | `main` có thay đổi chưa test; phát hành staging bản mới |

## Khi bản production có lỗi

Không sửa hay xoá tag. Sửa bằng một nhánh `fix/*` bình thường, xem phần sửa lỗi gấp trong [nhánh và phát hành](../wiki/engineering/branching-and-release.md).

## Khi build staging lỗi

Workflow **build-staging** chỉ build phần có thay đổi. Nếu build lỗi vì sự cố tạm thời thì chạy lại chính lần chạy đó bằng **Re-run failed jobs**. Phát hành số mới không giúp được, vì so với tag trước đó không có thay đổi mới để build.

## Hiện trạng

Chưa có server, nên hai workflow mới build và kiểm tra image; bước deploy thật sẽ thêm khi có hạ tầng.
