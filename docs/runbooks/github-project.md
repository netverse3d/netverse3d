# Cấu hình GitHub Project

Cấu hình repo, Project và bộ issue đều nằm trong mã. Các script chạy lặp lại được, không tạo trùng.

## Lệnh

| Lệnh                                         | Việc                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `node scripts/github/setup-repo.mjs`         | Áp cấu hình repo, nhãn, ruleset, Environment, Pages rồi đọc lại để đối chiếu                                  |
| `node scripts/github/setup-repo.mjs --check` | Chỉ đối chiếu, báo khác biệt                                                                                  |
| `node scripts/github/setup-project.mjs`      | Tạo Project, field; tạo hoặc đổi tên Milestone theo mã `Mx`                                                   |
| `node scripts/github/seed-issues.mjs`        | Dời issue sang đúng Milestone, rồi tạo issue còn thiếu từ sổ yêu cầu và `docs/requirements/backlog-seed.yaml` |

Cần quyền `gh auth refresh -s project`.

## Khi đổi lộ trình

Sổ yêu cầu là nguồn duy nhất cho Milestone của issue do script sinh ra.

1. Sửa `docs/requirements/milestones.yaml` và `registry.yaml` qua PR. Tiêu đề Milestone luôn bắt đầu bằng `Mx · `.
2. Sau khi merge, chạy `setup-project.mjs` trước để đổi tên Milestone, rồi mới chạy `seed-issues.mjs`.
3. `seed-issues.mjs` dời mọi issue đang mở do sổ yêu cầu sinh ra mà nằm sai mã Milestone. Dời bằng tay trên GitHub sẽ bị đảo lại ở lần chạy sau. Issue không có Milestone, issue đã đóng và issue tự tạo không bị đụng tới.

## Thay đổi cấu hình

Sửa `.github/settings/repository.json` qua PR, rồi chạy `setup-repo.mjs`.

## Trước khi mời thành viên

Làm xong [GitHub App](./github-app.md) trước, vì khi chưa có App thì ai có quyền ghi cũng tạo tay được tag phát hành.

## Mời thành viên

1. Chủ tổ chức cấp thêm quyền: `gh auth refresh -s admin:org`.
2. Tạo team `core` có quyền ghi vào repo, nhưng chưa thêm ai.
3. Sửa `.github/settings/repository.json` qua PR:

```json
{
  "approvals": 1,
  "preventSelfReview": true,
  "releaseReviewers": [{ "type": "Team", "slug": "core" }]
}
```

4. Chạy `node scripts/github/setup-repo.mjs`.
5. Mời thành viên vào team `core`.

Kết quả mong đợi: PR cần một thành viên khác duyệt, người bấm phát hành production không tự duyệt được.

## Các view của Project

Tạo trong giao diện Project nếu API không hỗ trợ:

| View           | Kiểu    | Thiết lập                                 |
| -------------- | ------- | ----------------------------------------- |
| Bảng công việc | Board   | Nhóm theo Status, lọc `-status:Done`      |
| Theo Milestone | Table   | Nhóm theo Milestone, sắp theo Priority    |
| Theo người     | Table   | Nhóm theo Assignees, lọc `-status:Done`   |
| Lộ trình       | Roadmap | Nhóm theo Milestone                       |
| Cần chốt       | Table   | Lọc `label:needs-decision,waiting-mentor` |
