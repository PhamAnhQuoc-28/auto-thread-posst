import { chromium } from 'playwright';
import path from 'path';

(async () => {
  console.log('Khởi chạy trình duyệt (UI Automation)...');
  const browser = await chromium.launch({ headless: false, slowMo: 700 });
  const context = await browser.newContext({ 
    viewport: { width: 1400, height: 900 },
    recordVideo: { dir: 'videos/', size: { width: 1400, height: 900 } }
  });
  const page = await context.newPage();

  console.log('Truy cập trang chủ UI...');
  await page.goto('http://127.0.0.1:4173');
  await page.waitForTimeout(2000); // Cho người dùng nhìn thấy trang trắng (hoặc dữ liệu cũ)

  const products = [
    {
      id: 'butter-squishy',
      name: 'Butter Squishy Sale',
      topic: 'viral',
      text: 'Hôm nay toai vui quá\nTôi sale 2 mẫu này\n🏷️ 20.000đ\nSale tới hết CN 27/9 về lại 25.000đ nhen\n📍Shop online Da Nang',
    },
    {
      id: 'squishy-vaseline',
      name: 'Squishy Butter Vaseline',
      topic: '',
      text: 'Squishy butter vaseline 14cm\n📍Shop online Da Nang',
    },
    {
      id: 'mangosteen-vaseline',
      name: 'Măng cụt vaseline',
      topic: 'squishy',
      text: 'Toai gom luôn em măng cụt vaseline\n🏷️ 50.000đ 1 em\nMua càng nhiều sale càng nhiều nha mấy mommm\n📍Shop online Da Nang',
    }
  ];

  const imagePath = path.resolve(process.cwd(), 'samples', 'flan-squishy.png');

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    console.log(`Bắt đầu nhập dữ liệu cho sản phẩm: ${p.name}`);
    
    // Nhấn nút + Thêm (ở sidebar hoặc nút to ở giữa)
    const addButton = page.getByRole('button', { name: /\+ Thêm/i }).first();
    await addButton.click();

    // Điền Tên sản phẩm
    await page.getByPlaceholder('Ví dụ: Squishy hình gấu').fill(p.name);
    
    // Điền Mã sản phẩm
    await page.getByPlaceholder('product-a').fill(p.id);

    // Điền Topic
    if (p.topic) {
      await page.getByPlaceholder('squishy', { exact: true }).fill(p.topic);
    } else {
      await page.getByPlaceholder('squishy', { exact: true }).fill('');
    }

    // Điền Nội dung
    await page.locator('.ProseMirror').fill(p.text);

    // Upload hình ảnh
    console.log('Đang upload ảnh placeholder...');
    await page.locator('input[type="file"]').setInputFiles(imagePath);
    
    // Đợi ảnh upload xong (xuất hiện trong grid) hoặc báo lỗi
    try {
      await Promise.race([
        page.locator('.image-card img').last().waitFor({ state: 'visible', timeout: 8000 }),
        page.locator('.alert.error').waitFor({ state: 'visible', timeout: 8000 }).then(async () => {
          const err = await page.locator('.alert.error').innerText();
          throw new Error('Lỗi từ giao diện: ' + err);
        })
      ]);
    } catch (e: any) {
      console.log('Cảnh báo khi upload ảnh:', e.message);
    }
    await page.waitForTimeout(1000); // Dừng lại một chút cho người dùng quan sát
  }

  console.log('Lưu dữ liệu...');
  await page.getByRole('button', { name: 'Lưu dữ liệu' }).click();

  // Đợi thông báo thành công
  await page.getByText('Đã lưu. Dữ liệu sẵn sàng cho post.bat.').waitFor({ state: 'visible', timeout: 5000 });
  console.log('Lưu thành công!');

  await page.waitForTimeout(3000); // Giữ màn hình thêm 3 giây để người dùng xem kết quả
  await browser.close();
})();
