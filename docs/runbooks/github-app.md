# Tạo GitHub App để phát hành

Workflow **release** dùng một GitHub App của tổ chức để tạo tag, vì tag tạo bằng `GITHUB_TOKEN` không kích hoạt workflow khác và token cá nhân sẽ hỏng khi người đó rời nhóm. Làm một lần, cần quyền chủ tổ chức.

## 1. Tạo App

1. Mở `https://github.com/organizations/netverse3d/settings/apps/new`.
2. Điền:
   - **GitHub App name:** `netverse3d-release`
   - **Homepage URL:** `https://github.com/netverse3d/netverse3d`
   - **Webhook:** bỏ chọn **Active**
   - **Repository permissions → Contents:** `Read and write`
   - **Where can this GitHub App be installed:** `Only on this account`
3. Bấm **Create GitHub App**. Ghi lại **App ID** và **Client ID**.

## 2. Tạo khoá

1. Trong trang App, phần **Private keys**, bấm **Generate a private key**. Trình duyệt tải về một tệp `.pem`.
2. Giữ tệp ngoài thư mục repo. Không gửi qua chat.

## 3. Cài App vào repo

1. Trong trang App, chọn **Install App**, cài vào tổ chức `netverse3d`.
2. Chọn **Only select repositories** rồi chọn `netverse3d`.

## 4. Lưu vào repo

Chạy trên máy của chủ tổ chức, thay đường dẫn tệp khoá và Client ID:

```
gh variable set RELEASE_APP_CLIENT_ID -R netverse3d/netverse3d -b <client-id>
gh secret set RELEASE_APP_PRIVATE_KEY -R netverse3d/netverse3d < <đường-dẫn-tệp.pem>
```

Kết quả mong đợi: `gh variable list` và `gh secret list` có hai tên trên. Sau đó xoá tệp `.pem` khỏi máy.

## 5. Chỉ cho App tạo tag

```
node scripts/github/setup-repo.mjs --release-app-id <app-id>
```

Kết quả mong đợi: tạo tay tag `stg-v*` hoặc `prod-v*` bị từ chối, còn workflow **release** thì tạo được.

## Xoay vòng khoá

Tạo khoá mới trong trang App, chạy lại lệnh `gh secret set` ở bước 4, rồi xoá khoá cũ.
