# ADR-0019: Thế giới chỉ lắp từ thành phần đã đăng ký và dùng chung một chuẩn dựng hình

- Trạng thái: accepted
- Ngày: 2026-11-11

## Bối cảnh

[REQ-042](../requirements/registry.yaml) mở thế giới từ một con hẻm thành một thành phố nhiều khu. Số mô hình, số người làm và số cảnh đều tăng, nên hai điểm yếu đang có sẽ lộ rõ.

Thứ nhất, chưa có luật buộc mọi thứ hiện trong thế giới phải đi qua thư viện 3D. Bộ mô hình đã khai trong `assets.config.json` và thư viện đã có test buộc mỗi bộ thuộc đúng một mục, nhưng cảnh vẫn có thể tự dựng hình bằng mã hoặc nạp một tệp chưa khai mà không công cụ nào báo.

Thứ hai, ánh sáng được thiết lập riêng ở từng nơi. Cảnh tiệm trong game, phòng thử tiệm, tiệm giới thiệu, hẻm mẫu, phòng lab, trang danh mục và bộ đèn studio của thư viện mỗi nơi tự đặt đèn, độ phơi sáng và nền. Chưa nơi nào bật bóng đổ thời gian thực; bóng hiện chỉ là lớp che khuất nướng sẵn trên từng món, nên nhân vật và xe không có bóng tiếp đất. Ngoài trời vẫn dùng bản đồ môi trường của một căn phòng, chưa có bầu trời và sương.

Người dẫn dắt nhóm chốt ngày 2026-11-11: mọi thứ sinh ra phải từ thành phần đăng ký lên thư viện để kiểm soát tập trung, và ánh sáng, đổ bóng phải nhất quán theo một chuẩn.

## Quyết định

1. Mọi thứ nhìn thấy trong thế giới là một thành phần đã đăng ký: có mục trong `assets.config.json`, có bản gốc theo [ADR-0015](./ADR-0015-blender-sources-as-master.md) hoặc [ADR-0018](./ADR-0018-script-generated-asset-sources.md), có mức trần tam giác và xem được trong một mục của thư viện 3D.
2. Cảnh là dữ liệu. Khối phố, khu và bản đồ thành phố chỉ tham chiếu thành phần theo tên đã đăng ký. Mã cảnh không tự dựng hình cho vật thể của thế giới; hình hỗ trợ kỹ thuật như hộp va chạm hay lưới gỡ lỗi không tính.
3. Công cụ kiểm đỏ khi dữ liệu cảnh tham chiếu thành phần chưa đăng ký hoặc khi một bộ mô hình không thuộc mục nào của thư viện.
4. Ánh sáng, bóng đổ, bầu trời và sương, độ phát sáng của neon, ánh xạ tông màu và lớp vật liệu khai ở một nơi duy nhất trong `packages/game-assets/runtime`. Game và mọi trang thư viện dùng chung nơi đó, không tự đặt đèn.
5. Mỗi bối cảnh có một bộ ánh sáng đặt tên, tối thiểu là phòng studio, trong tiệm và phố đêm. Thư viện có chỗ xem một thành phần dưới từng bộ.
6. Thông số cụ thể của chuẩn nằm ở `docs/wiki/engineering`, do các việc phân tích kỹ thuật chốt và đo trên GPU thật theo REQ-004.
7. Công trình nổi tiếng giữ nguyên [ADR-0014](./ADR-0014-saigon-cyber-and-own-characters.md): chỉ gợi hình, mang tên riêng của Netverse, không dùng tên hay thương hiệu thật.

## Hệ quả

- Thêm một món vào thế giới luôn gồm ba bước: dựng, đăng ký, xem trong thư viện. Việc này chậm hơn dựng thẳng trong cảnh nhưng cả nhóm thấy cùng một danh mục và cùng mức trần.
- Các chỗ đang tự đặt đèn phải chuyển sang chuẩn chung; ảnh của tiệm và hẻm mẫu có thể đổi nhẹ sau khi chuyển và cần người dẫn dắt duyệt lại.
- Bóng đổ thời gian thực và bầu trời làm tăng tải; mức chất lượng thấp phải tắt được từng phần để giữ REQ-004.
- Hợp đồng `street-block.v1` còn nháp sẽ được mở rộng hoặc nối tiếp bằng hợp đồng bản đồ thành phố.
