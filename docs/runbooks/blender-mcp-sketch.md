# Phác hình trong Blender qua MCP rồi chuyển thành script

Dùng khi đang tìm dáng một món hay một module mới. Trợ lý gửi mã Python thẳng vào Blender đang mở, chụp viewport trong vài giây, lặp tới khi ưng rồi viết lại thành hàm trong `packages/game-assets/pipeline/` theo [ADR-0018](../decisions/ADR-0018-script-generated-asset-sources.md). Bản phác không bao giờ vào repo; bản gốc vẫn là script.

Đã chạy thật ngày 11/11/2026 trên Windows 11, Blender 5.2, `mcp-for-blender` 2.2.7 (MIT), addon 1.8. Các đường dẫn dưới là của Windows; trên macOS và Linux thư mục addon nằm trong thư mục cấu hình Blender của người dùng và `uv` cài bằng bộ cài chính thức.

## Cài một lần

| Bước | Lệnh                                                                                                                                                                                                                                                                                                   | Kết quả mong đợi                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 1    | Cài `uv` bằng bộ cài chính thức (`scoop install uv` hoặc `irm https://astral.sh/uv/install.ps1 \| iex`)                                                                                                                                                                                                | `uvx --version` in ra phiên bản                                                                  |
| 2    | `uvx mcp-for-blender install-addon`                                                                                                                                                                                                                                                                    | Tệp `blender_mcp.py` nằm trong `%APPDATA%\Blender Foundation\Blender\<phiên bản>\scripts\addons` |
| 3    | Bật addon bằng đường dẫn đầy đủ tới Blender: `"C:Program FilesBlender FoundationBlender 5.2lender.exe" --background --python-expr "import bpy; bpy.ops.preferences.addon_enable(module='blender_mcp'); bpy.ops.wm.save_userpref(); print('ENABLED', 'blender_mcp' in bpy.context.preferences.addons)"` | In `ENABLED True`; hoặc bật tay ở Edit → Preferences → Add-ons → MCP for Blender                 |
| 4    | `claude mcp add blender -e DISABLE_TELEMETRY=true -- uvx mcp-for-blender`                                                                                                                                                                                                                              | `claude mcp get blender` báo Connected; công cụ MCP xuất hiện ở phiên Claude Code mới            |

Bước 2 có thể in lỗi mã hoá ở dòng thông báo cuối trên console Windows; tệp vẫn được chép, kiểm bằng cách xem thư mục addons.

## Mỗi lần phác

1. Mở Blender có giao diện. Addon tự mở socket `127.0.0.1:9876` sau nửa giây; không cần bấm gì. Lưu việc đang làm trước, vì mã gửi vào chạy với toàn quyền trong Blender.
2. Viết bản phác thành một tệp Python ngoài repo (ví dụ `..
etverse3d-artsketchesacade-sketch.py`): xoá cảnh, dựng khối bằng `bpy.ops.mesh.primitive_*`, đặt camera. Đường dẫn tương đối tính từ thư mục đang đứng.
3. Chạy và chụp:

   ```
   pnpm assets:sketch ..
   ```

etverse3d-artsketchesacade-sketch.py ..
etverse3d-artsketchesacade-sketch.png

```

Lệnh gửi hai bước qua socket: `execute_code` rồi `get_viewport_screenshot`; ảnh ghi ra đúng đường dẫn đã cho; addon báo lỗi (ví dụ không có viewport 3D) thì lệnh thoát khác 0. Phác mặt tiền nhà ống 20 khối và chụp mất dưới 5 giây.

4. Xem ảnh, sửa tệp, chạy lại. Trong phiên Claude Code mới, trợ lý có thể gọi thẳng công cụ MCP `execute_blender_code`, `look`, `get_scene_info` thay cho lệnh trên.
5. Ưng dáng rồi thì viết lại thành hàm `build_*` trong `pipeline/` với `HeroPart` (loft, pillow, rounded_box, revolve), khai ô đồ trong `assets.config.json`, sinh lại bộ bằng `pnpm assets:generate <bộ>`, soi trong lab, rồi xuất. Cách sinh thử không nướng, nếu có, ghi trong wiki game-assets.

Biến `BLENDER_PORT` đổi cổng nếu 9876 bận; cổng trong bảng addon (phím N → tab MCP for Blender) phải trùng.

## Ranh giới

- Chỉ phác và nhìn. Không lưu `.blend` phác vào `source/`; không chép mã phác vào `pipeline/` nguyên trạng.
- Không dùng `generate_3d`, `search_assets`, `import_asset`: tài sản từ dịch vụ ngoài có giấy phép không rõ, trái [ADR-0014](../decisions/ADR-0014-saigon-cyber-and-own-characters.md) và quy tắc nguồn gốc của repo.
- Socket không có xác thực. Chỉ mở trên máy cá nhân, không mở ra mạng.
- Mỗi máy một máy chủ MCP cho Blender; không chạy `uvx mcp-for-blender` bằng tay khi Claude Code đang quản nó.

## Khi hỏng

| Dấu hiệu                                  | Nguyên nhân thường gặp                                     | Cách xử lý                                                                           |
| ----------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Blender socket 9876: ECONNREFUSED`       | Blender chưa mở, addon chưa bật, hoặc đang mở ở chế độ nền | Mở Blender có giao diện; kiểm addon trong Preferences                                |
| `Blender did not answer within 120000 ms` | Mã phác treo hoặc hộp thoại đang chặn Blender              | Nhìn cửa sổ Blender, đóng hộp thoại; rút ngắn mã                                     |
| Ảnh chụp không đúng góc                   | Viewport không ở camera                                    | Trong mã đặt `area.spaces[0].region_3d.view_perspective = 'CAMERA'` cho vùng VIEW_3D |
| `spawn uvx ENOENT` trong Claude Desktop   | Ứng dụng GUI không thấy PATH của terminal                  | Ghi đường dẫn đầy đủ tới `uvx` trong cấu hình MCP                                    |
```
