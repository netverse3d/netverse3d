# Nghiệm thu dựng nền repository

Kết quả chạy trên GitHub thật ngày 07–08/11/2026. Chạy lại khi đổi quy trình hoặc cấu hình.

## Đã đạt

| Kiểm tra                            | Cách làm                                                             | Kết quả                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cấu hình khớp mã                    | `node scripts/github/setup-repo.mjs --check`                         | `GitHub settings match`                                                                  |
| Không push thẳng                    | Push một commit lên `staging`                                        | Bị từ chối: `Changes must be made through a pull request`                                |
| Luật của `main`                     | `gh api repos/netverse3d/netverse3d/rules/branches/main`             | Chỉ nhận merge commit, cần đủ 3 check                                                    |
| Luật của `staging`                  | Như trên, với `staging`                                              | Chỉ nhận squash, cần đủ 3 check                                                          |
| PR thiếu truy vết                   | PR đổi tệp trong `infra/`, mô tả không có REQ                        | `trace` đỏ, trạng thái `BLOCKED`, merge bị từ chối                                       |
| Bổ sung truy vết                    | Sửa mô tả, thêm `Refs #2` và `REQ-027`                               | `trace` xanh mà không cần push lại                                                       |
| Release sai định dạng               | Chạy `web-3d` với phiên bản `1.04.0`                                 | Dừng ở `validate`: `Version must look like 1.4.0`, không có tag                          |
| Release sai nhánh                   | Chạy `web-3d` production trên `staging`                              | Dừng ở `validate`: `web-3d/prod-v0.1.0 must be on main`, không có tag                    |
| Release hợp lệ khi chưa có App      | Chạy `web-3d` staging với `0.1.0`                                    | `validate` xanh, bước tạo tag dừng vì thiếu App, không có tag                            |
| Clone sạch                          | `git clone`, `pnpm bootstrap`, `pnpm verify`                         | Exit 0, git hook được bật, không có tệp local nào trong repo                             |
| Commit sai định dạng                | Chạy `.githooks/commit-msg` với `bad message`                        | Exit 1                                                                                   |
| Hạ tầng dev                         | `pnpm infra:smoke` trên máy local và trên CI                         | Đủ 7 dịch vụ                                                                             |
| Admin không bỏ qua được Environment | `gh api repos/netverse3d/netverse3d/environments/production-release` | `can_admins_bypass: false`                                                               |
| Check không giả bằng status         | `gh api repos/netverse3d/netverse3d/rules/branches/main`             | Mỗi check có `integration_id: 15368`; một job Actions cùng tên vẫn cần người review để ý |
| Wiki                                | Mở trang sau khi merge vào `staging`                                 | HTTP 200                                                                                 |

## Chưa kiểm chứng được

| Kiểm tra                                                | Đang chờ                                 | Cách kiểm khi có                                                                       |
| ------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Chỉ App tạo được tag, tag do App tạo kích hoạt workflow | [GitHub App](./github-app.md)            | Chạy Release staging, thấy `web-3d/stg-v0.1.0` và workflow `build-staging` chạy        |
| Không tạo tay được tag, không sửa xoá được tag          | GitHub App                               | Thử tạo tag `web-3d/stg-v9.9.9`, thử xoá một tag đã có                                 |
| Khoá App không đọc được từ nhánh khác                   | GitHub App                               | Chạy workflow sửa đổi trên nhánh thử, secret của Environment phải rỗng hoặc bị từ chối |
| Trọn vòng production dừng ở bước duyệt                  | GitHub App, promote `staging` lên `main` | Chạy Release production, thấy chờ duyệt rồi ra `web-3d/prod-v0.1.0`                    |
| Duyệt chéo giữa hai người                               | Mời thành viên                           | Thực hiện phần cuối của [cấu hình Project](./github-project.md)                        |
| Dùng lại đúng image đã test                             | Service đầu tiên có Dockerfile           | So digest của image `0.1.0` và `prod-v0.1.0`                                           |
| Git hook hỏi trên terminal thật                         | Người dùng chạy thử                      | Push thay đổi mã sản phẩm chưa gắn REQ                                                 |
| Admin không vượt được ruleset                           | Thử bằng tài khoản owner trên PR thử     | `gh pr merge --admin` phải bị từ chối                                                  |
