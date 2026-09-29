# Threads Studio — chạy local

## Cài đặt lần đầu

1. Cài Node.js, chạy `npm install` và `npx playwright install chromium` trong thư mục dự án.
2. Mở `login.bat`, đăng nhập Threads trong cửa sổ trình duyệt rồi đóng cửa sổ đó.

## Soạn và lưu bài bằng giao diện

1. Nhấp đúp `editor.bat`. File này build giao diện, chạy server tại `http://127.0.0.1:4173` và mở trang soạn trong trình duyệt. Giữ cửa sổ lệnh mở trong khi sử dụng. Nếu trình duyệt không tự mở, truy cập địa chỉ trên.
2. Thêm sản phẩm theo thứ tự muốn đăng. Trong mỗi sản phẩm, thêm các phiên bản nội dung cho ngày 1, ngày 2…; viết bài trong Tiptap, nhập topic như `squishy` nếu cần, và tải ảnh JPG, PNG hoặc WebP. Thanh công cụ hỗ trợ hoàn tác, làm lại và mở bảng chọn emoji lớn hơn. Có thể tìm tên emoji bằng tiếng Việt (ví dụ `cười`, `tim`, `hoa`) hoặc chuyển sang English; bảng emoji chỉ tải khi mở. Bảng chọn chỉ hiện emoji đến phiên bản 12.1 vì font trên máy đăng hiện tại hiển thị một số emoji mới thành ô vuông. Nếu dán emoji mới trực tiếp, giao diện sẽ cảnh báo và yêu cầu thay trước khi lưu. Phần dưới ô soạn cho xem trước văn bản thực sự sẽ đăng. Có thể đổi thứ tự sản phẩm, phiên bản và ảnh bằng các nút mũi tên.
3. Chỉnh khoảng cách giữa các bài. Bấm **Lưu dữ liệu**. Nội dung Tiptap được chuyển thành văn bản thuần, giữ xuống dòng, emoji và link, rồi lưu ở trường `text` trong từng file `data/products/<id>.json`; bộ đăng bài đọc cùng cấu trúc này. Cấu hình lưu ở `data/session-config.json`, ảnh ở `data/media/`. Trang kiểm tra mã sản phẩm, nội dung, topic và file ảnh trước khi lưu. Ảnh tải lên đã nằm trên máy; hãy bấm Lưu để gắn ảnh vào nội dung.
4. Bấm **Xem lượt sáng** hoặc **Xem lượt chiều** để kiểm tra phiên bản nội dung, topic, ảnh và giờ dự kiến. Bản xem trước chỉ đọc dữ liệu đã lưu; không tạo hay đăng bài.
5. Đóng trang và cửa sổ lệnh khi soạn xong. Dữ liệu đã lưu vẫn còn trên máy.

## Đăng bài

Nhấp đúp `post.bat` và chọn:

- `1`: lượt sản phẩm buổi sáng.
- `2`: lượt sản phẩm buổi chiều.
- `3`: một bài đơn lẻ `pending` trong `data/posts.json`.

Giữ cửa sổ lệnh và máy tính hoạt động cho tới khi lượt kết thúc. `schedule.bat` vẫn có thể dùng để chọn riêng sáng hoặc chiều. Không có sản phẩm trong `data/products/` thì lượt sáng/chiều sẽ báo lỗi trước khi mở Threads.

Ngày chạy đầu tiên, hai lượt sáng và chiều cùng dùng phiên bản 1 của mỗi sản phẩm. Ngày chạy tiếp theo dùng phiên bản 2; khi hết phiên bản của một sản phẩm, sản phẩm đó quay về phiên bản 1. Chỉ ngày có ít nhất một lượt được tạo mới tính là một ngày chạy. Lượt thứ hai trong ngày sao chép đúng chữ, ảnh và topic của lượt đầu. Sản phẩm đầu tiên được thử ngay; các bài kế tiếp theo khoảng cách đã cấu hình. Nếu một bài lỗi, công cụ ghi `failed`, bỏ qua và tiếp tục sản phẩm kế tiếp.

`data/posts.json` lưu lịch sử và trạng thái từng bài. Chạy lại cùng buổi trong cùng ngày tiếp tục các bài `pending`, không tạo lượt trùng. Bài `failed` không tự thử lại; muốn thử lại, hãy kiểm tra nguyên nhân rồi đổi đúng bài đó về `pending`. Nếu còn `publishing` sau khi chương trình bị ngắt, kiểm tra Threads trước khi đổi trạng thái để tránh đăng trùng.

Sau khi bấm Post, công cụ đợi Threads hiện `Posted` tối đa 20 giây trước khi đóng trình duyệt. Bài chuyển sang `needs_review`; hãy xác nhận nó xuất hiện trên trang cá nhân rồi đổi thành `published`. Nếu không thấy xác nhận, ảnh màn hình được lưu trong `logs/`. Nếu Threads trả HTTP 429, bài đó được ghi `failed` và lượt tiếp tục với các bài sau theo lịch.

## Chỉnh file trực tiếp

Có thể sửa từng file trong `data/products/` theo cấu trúc `data/products.example.json`. Bài đơn lẻ theo mẫu `data/posts.example.json`; `post.bat` lựa chọn `3` sẽ đăng một bài `pending` đã đến giờ. Với topic, dùng tên gợi ý chính xác từ Threads, ví dụ `"topic": "squishy"`.

## Chuyển bài đã scrape thành phiên bản sản phẩm

1. Chạy `npm run convert:scraped -- preview data/scraped/nuis07.studio_posts.json`. Lệnh tạo `data/imports/nuis07.studio.review.json` với nội dung đã bỏ tên tài khoản, thời gian, chữ `Translate` và số tương tác. Nếu file review đã có, lệnh không ghi đè phần bạn đang sửa.
2. Mở file review. Với mỗi bài muốn dùng, đặt `include` thành `true`, nhập `productId` trùng sản phẩm hiện có hoặc ID mới, và nhập `productName` nếu tạo sản phẩm mới. `action: "append"` thêm phiên bản mới; `action: "replace"` cùng `contentId: "v1"` thay phiên bản cũ, hữu ích khi cần phục hồi ảnh đang thiếu. Có thể sửa `text`, `topic` và `mediaIndexes` (vị trí ảnh trong `mediaUrls`). Thứ tự các mục được chọn sẽ là thứ tự phiên bản mới được thêm. Kiểm tra kỹ nội dung và quyền dùng ảnh trước khi nhập.
3. Chạy `npm run convert:scraped -- apply data/imports/nuis07.studio.review.json`. Lệnh tải ảnh được chọn về `data/media/<productId>/`, rồi thêm `v2`, `v3`… hoặc tạo sản phẩm mới trong `data/products/`. Chạy lại cùng file sẽ bỏ qua bài đã nhập. Không tự tạo phiên đăng hay đăng lên Threads.

Video chưa được nhập vì bộ lưu media và kiểm tra đường dẫn hiện mới hỗ trợ JPG, PNG và WebP. File review có ghi cảnh báo cho bài chứa video hoặc emoji không tương thích. Nếu URL ảnh tạm thời đã hết hạn, scrape lại tài khoản và tạo file review mới.

Ngày 28/09/2026, bài thử chỉ chữ, emoji thông dụng và bài có ảnh mẫu cùng topic `squishy` đã được xác nhận trên Threads. Emoji 🫩 được gửi đúng mã Unicode nhưng hiện thành ô vuông trên trình duyệt Windows của máy này, nên bản soạn hiện giới hạn emoji như mô tả trên.
