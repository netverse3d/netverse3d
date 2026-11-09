# ADR-0014: Bối cảnh Sài Gòn cyber, nhân vật và bot do nhóm tự thiết kế

- Trạng thái: proposed
- Ngày: 2026-11-09

## Bối cảnh

Các nguồn của mentor chưa nói thế giới 3D trông thế nào. Ảnh gameplay chỉ cho thấy tiệm net neon tím xanh, còn bản demo dùng một bộ nhân vật cố định, ai chọn cùng mẫu thì giống hệt nhau.

Nhóm đã thử nhiều hướng trên một bản phác dựng bằng mã, đặt ngoài repo. Người dẫn dắt nhóm đã xem và chọn các điểm dưới đây. Bản phác để chốt hướng, không phải đồ hoạ cuối.

## Quyết định

**Sản phẩm**

- Thể loại nghiêng về tycoon: mở tiệm, phục vụ khách, mở rộng.
- Trọng tâm là cả game lẫn ứng dụng AI. Nếu được chốt, điểm này thay phần "AI làm sau" trong [ADR-0002](./ADR-0002-product-scope.md).
- Hướng thiết kế: khách có nhu cầu riêng về giá, cấu hình máy, độ đông và dịch vụ, để các tiệm khác nhau ở thứ người chơi cảm nhận được. Cơ chế cụ thể còn nằm ở câu hỏi mở.

**Bối cảnh**

- Thế giới là TP.HCM phiên bản cyber về đêm: hẻm, nhà ống, ban công, dây điện, biển hiệu tiếng Việt, mưa.
- Công trình nổi tiếng chỉ gợi hình, không chép chính xác, không dùng tên hay thương hiệu của công trình tư nhân.

**Mỹ thuật môi trường**

- Nhà cửa và đồ vật tối, trầm; màu đến từ ánh đèn.
- Tỷ lệ tính theo chiều cao nhân vật.
- Bề mặt có vết thời gian. Biển hiệu ít, nền tối, chữ dịu.
- Nhân vật dùng toon, môi trường dùng vật liệu thường, để nhân vật nổi lên.
- Mỗi tiệm có một màu nhấn do chủ tiệm chọn, mặc định tím điện.

**Nhân vật người**

- Dáng chibi, chất liệu toon ba bậc.
- Một thân gốc, một bộ xương chung. Tóc, áo, quần, giày, phụ kiện là các món rời; từng phần đổi được màu.
- Tài khoản chỉ lưu công thức nhân vật: mã từng món và màu.
- Mười hai biểu cảm đổi được khi chơi, tăng từ tám theo [ADR-0015](./ADR-0015-blender-sources-as-master.md). Biểu cảm là trạng thái lúc chơi, không nằm trong công thức.

**Bot**

- Bot là một dòng robot thuần, cùng dáng chibi và bộ xương với người chơi. Không thiết kế bot thành đồ vật.
- Mặt kính đen với mắt LED là dấu hiệu nhận ra bot. Các mẫu khác nhau ở dáng, màu, kiểu mắt và chi tiết trên đầu, theo vai trò.

**Nguồn tài sản**

- Không dùng lại nhân vật của bản demo hay bộ nhân vật có sẵn cho sản phẩm. Nhóm tự thiết kế.

## Hệ quả

- Dựng bằng mã không đạt được độ đẹp cuối cùng. Nhóm cần một người làm được Blender để nặn thân, đồ và công trình theo đúng bộ xương và ô đồ.
- Người chơi cần gắn da vào bộ xương để áo co giãn theo cơ thể. Bot dùng chung khung xương và chuyển động, nhưng có thể là các khối cứng gắn theo từng xương, không cần gắn da, nên dùng instancing theo bộ phận được.
- Ngồi gõ phím dùng IK để tay chạm phím theo tỷ lệ từng nhân vật, thay vì phụ thuộc vào clip.
- Chưa đo hiệu năng trên GPU thật. Sức chứa mục tiêu còn nằm ở câu hỏi 6; ảnh của mentor ghi 50 máy nên có thể đo thử với số đó.
- Những điểm còn mở nằm ở [câu hỏi mở](../wiki/open-questions.md).

Liên quan: REQ-003, REQ-013, REQ-019, REQ-035, REQ-037, REQ-038, REQ-039, [ADR-0010](./ADR-0010-one-way-virtual-currency.md), [ADR-0012](./ADR-0012-games-for-rl-bots.md).
