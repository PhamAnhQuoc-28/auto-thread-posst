import { chromium } from 'playwright';
import path from 'path';

(async () => {
  // 1. Khởi động trình duyệt ảo
  console.log('Khởi chạy trình duyệt...');
  const browser = await chromium.launch({ headless: false }); // Để false để bạn có thể nhìn thấy nó hoạt động
  const page = await browser.newPage();

  // 2. Truy cập vào trang web giả định
  // Trong thực tế, đây sẽ là đường dẫn https://... của một tài khoản nào đó
  const localHtmlPath = `file://${path.resolve(process.cwd(), 'scratch/dummy.html')}`;
  console.log(`Truy cập: ${localHtmlPath}`);
  await page.goto(localHtmlPath);

  // 3. Mô phỏng hành vi con người (Cuộn chuột)
  // Các trang mạng xã hội thường dùng "lazy-loading", nghĩa là bạn cuộn tới đâu ảnh mới load tới đó
  console.log('Bắt đầu cuộn trang để tải thêm bài viết...');
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(1000); // Dừng 1 giây để mạng tải dữ liệu
  }

  // 4. Trích xuất dữ liệu (Cào Data)
  console.log('Đang trích xuất dữ liệu DOM...');
  // Tìm TẤT CẢ các thẻ có class là .post-item
  const posts = await page.locator('.post-item').all();
  const results = [];

  for (const post of posts) {
    // 4.1 Lấy nội dung chữ
    const textElement = post.locator('.post-text');
    // Nếu có class .post-text thì lấy chữ bên trong ra
    const text = await textElement.count() ? await textElement.innerText() : '';

    // 4.2 Lấy link hình ảnh
    const imgElement = post.locator('.post-image');
    // Nếu bài viết có ảnh, lấy thuộc tính "src" của thẻ <img>
    const imageUrl = await imgElement.count() ? await imgElement.getAttribute('src') : null;

    results.push({ text, imageUrl });
  }

  // 5. In kết quả thu được hoặc lưu vào file JSON
  console.log('\n--- KẾT QUẢ CÀO DỮ LIỆU ---');
  console.log(JSON.stringify(results, null, 2));

  console.log('\nQuá trình cào hoàn tất. Đóng trình duyệt sau 3 giây...');
  await page.waitForTimeout(3000);
  await browser.close();
})();
