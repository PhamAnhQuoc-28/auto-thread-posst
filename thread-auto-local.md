# Local Threads Auto Post – Implementation Plan

## 1. Mục tiêu

Tạo một tool nhỏ chạy hoàn toàn trên Windows để tự động đăng bài lên Threads.

Không sử dụng server, Cloud Run hoặc deploy.

Workflow:

```text
Đăng nhập Threads thủ công một lần
        ↓
Chuẩn bị nội dung bài
        ↓
Double-click post.bat
        ↓
Browser tự mở
        ↓
Sử dụng session đã đăng nhập
        ↓
Tạo và publish bài
        ↓
Ghi trạng thái
        ↓
Đóng browser
```

Không lưu username/password Threads.

---

# 2. Project Root

**Thư mục mà Antigravity hiện đang chạy/open workspace chính là project root.**

Không:

* tạo thêm một folder `threads-auto-post` bao ngoài project;
* yêu cầu người dùng cung cấp absolute path;
* hard-code `C:\...` hoặc `D:\...`;
* tự chuyển project sang thư mục khác.

Ví dụ nếu Antigravity đang chạy tại:

```text
D:\Tools\ThreadsAutomation
```

thì:

```text
D:\Tools\ThreadsAutomation
```

chính là project root.

Nếu Antigravity đang chạy tại:

```text
C:\Users\Admin\Desktop\AutoThread
```

thì chính folder đó là project root.

Tất cả file bên dưới phải được tạo tương đối từ **current workspace / current working directory**.

---

# 3. Technology Stack

Sử dụng:

* Node.js
* TypeScript
* Playwright
* Chromium
* JSON làm local data source
* Windows `.bat`

Không cần:

* Database
* Docker
* Server
* Cloud
* Threads API
* Selenium

---

# 4. Folder Structure

Tạo trực tiếp trong folder hiện tại:

```text
[current-folder]/
│
├── src/
│   ├── index.ts
│   ├── login.ts
│   │
│   ├── threads/
│   │   ├── threads.page.ts
│   │   └── threads.service.ts
│   │
│   ├── posts/
│   │   ├── post.repository.ts
│   │   └── post.types.ts
│   │
│   └── utils/
│       └── logger.ts
│
├── data/
│   └── posts.json
│
├── browser-data/
│
├── logs/
│
├── login.bat
├── post.bat
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

Nếu một số file/folder đã tồn tại:

* kiểm tra trước;
* reuse nếu phù hợp;
* không overwrite vô điều kiện.

---

# 5. Persistent Login

Sử dụng Playwright:

```ts
chromium.launchPersistentContext()
```

Browser profile lưu tương đối tại:

```text
./browser-data/
```

Không sử dụng Chrome profile chính của user.

Không hard-code:

```text
email
username
password
cookie
access token
```

Flow:

```text
login.bat
    ↓
npm run login
    ↓
Playwright mở browser
    ↓
User login Threads thủ công
    ↓
./browser-data lưu session
```

---

# 6. login.ts

`src/login.ts` có nhiệm vụ:

1. Resolve `browser-data` dựa trên project root/current project.
2. Mở persistent browser context.
3. Mở:

```text
https://www.threads.com/
```

4. Browser chạy visible:

```ts
headless: false
```

5. User tự login.
6. Không tự nhập username/password.
7. Session được lưu lại trong `browser-data`.

---

# 7. Post Data

Dùng:

```text
./data/posts.json
```

Ví dụ:

```json
[
  {
    "id": "post-001",
    "text": "Hello Threads 👋",
    "status": "pending",
    "createdAt": null,
    "publishedAt": null,
    "error": null
  }
]
```

Status:

```text
pending
publishing
published
failed
```

Không xóa lịch sử sau khi publish.

---

# 8. Post Selection

Mỗi lần chạy `post.bat`:

1. đọc `data/posts.json`;
2. tìm bài đầu tiên có `status = pending`;
3. chỉ đăng **một bài mỗi lần chạy**.

Ví dụ:

```text
post-001 → published
post-002 → pending
post-003 → pending
```

Lần tiếp theo sẽ đăng:

```text
post-002
```

---

# 9. Posting Flow

```text
Start
 ↓
Read posts.json
 ↓
Find first pending post
 ↓
Launch persistent browser
 ↓
Open Threads
 ↓
Check login session
 ↓
Open composer
 ↓
Enter post text
 ↓
Verify entered text
 ↓
Click Post
 ↓
Verify publish succeeded
 ↓
Update posts.json
 ↓
Close browser
```

Nếu không có pending post:

```text
No pending posts found.
```

và kết thúc.

---

# 10. Session Expired

Nếu Threads yêu cầu login:

Không tự login.

Dừng posting và hiển thị:

```text
Threads session expired.

Please run login.bat and login again.
```

Post hiện tại phải quay lại:

```text
pending
```

Không đánh dấu `failed`.

---

# 11. Threads Page Object

Tập trung toàn bộ selector tại:

```text
src/threads/threads.page.ts
```

Responsibilities:

```text
open()
isLoggedIn()
openComposer()
fillPost()
publish()
waitForPublished()
```

Không rải Threads selector trong nhiều file.

---

# 12. Selector Strategy

Ưu tiên:

```ts
getByRole()
getByText()
getByPlaceholder()
```

Sau đó mới dùng stable attributes hoặc CSS selectors.

Tránh selector phụ thuộc sâu vào DOM như:

```text
div:nth-child(4) > div > div:nth-child(2)
```

Tránh generated class names nếu có selector semantic tốt hơn.

---

# 13. Publish Verification

Không xem:

```text
click Post
```

là đã thành công.

Sau khi click phải verify bằng tín hiệu thực tế, chẳng hạn:

```text
composer đóng
```

hoặc:

```text
success state xuất hiện
```

hoặc:

```text
post vừa đăng xuất hiện
```

Chỉ sau khi verify mới set:

```text
published
```

---

# 14. Error Handling

Trước khi bắt đầu:

```text
pending → publishing
```

Thành công:

```text
publishing → published
```

Lỗi automation/publish:

```text
publishing → failed
```

và lưu:

```json
{
  "error": "error message"
}
```

Riêng session expired:

```text
publishing → pending
```

---

# 15. Logging

Ghi log tại:

```text
./logs/app.log
```

Ví dụ:

```text
[2026-09-22 21:00:01] Starting
[2026-09-22 21:00:02] Selected post: post-001
[2026-09-22 21:00:05] Opening Threads
[2026-09-22 21:00:08] Composer opened
[2026-09-22 21:00:12] Publishing
[2026-09-22 21:00:15] Published successfully
```

Không log:

```text
cookie
session token
password
```

---

# 16. Browser Mode

MVP:

```ts
headless: false
```

Người dùng phải nhìn thấy browser thao tác để dễ debug khi Threads thay đổi UI.

---

# 17. post.bat

`post.bat` phải hoạt động bất kể folder project nằm ở đâu.

Sử dụng:

```bat
@echo off
cd /d "%~dp0"

echo ======================================
echo Threads Auto Post
echo ======================================
echo.

call npm run post

echo.
echo ======================================
echo Process finished
echo ======================================

pause
```

**Không thay `%~dp0` bằng absolute path.**

`%~dp0` chính là folder chứa file `.bat`, tức project root.

---

# 18. login.bat

```bat
@echo off
cd /d "%~dp0"

echo ======================================
echo Threads Login
echo ======================================
echo.

call npm run login

pause
```

Cũng không hard-code đường dẫn.

---

# 19. package.json

Scripts:

```json
{
  "scripts": {
    "login": "tsx src/login.ts",
    "post": "tsx src/index.ts"
  }
}
```

MVP dùng `tsx`, không bắt buộc build TypeScript trước.

---

# 20. Path Handling trong TypeScript

Mọi đường dẫn nội bộ phải dựa trên project hiện tại.

Ví dụ có thể resolve:

```ts
path.resolve(process.cwd(), "data", "posts.json")
```

hoặc project root được xác định ổn định từ source.

Không viết:

```ts
"D:\\Source-code\\threads-auto-post\\data\\posts.json"
```

Không phụ thuộc username Windows.

Các path cần tương đối/project-root based:

```text
./data
./browser-data
./logs
```

---

# 21. .gitignore

Tối thiểu:

```gitignore
node_modules/
browser-data/
logs/
.env
```

`browser-data/` tuyệt đối không được commit.

---

# 22. README

## Setup lần đầu

```text
1. Install Node.js
2. npm install
3. npx playwright install chromium
4. Double-click login.bat
5. Login Threads manually
6. Close browser
```

Không yêu cầu user:

```text
cd C:\some\hardcoded\path
```

README phải giả định project có thể nằm ở bất kỳ folder nào.

---

# 23. User Workflow

### Lần đầu

```text
Double-click login.bat
        ↓
Browser mở
        ↓
Login Threads
        ↓
Close browser
```

### Thêm nội dung

Chỉnh:

```text
data/posts.json
```

### Đăng bài

```text
Double-click post.bat
        ↓
Browser mở
        ↓
Threads mở
        ↓
Tự tạo post
        ↓
Publish
        ↓
Browser đóng
```

Không cần:

```text
VS Code
Terminal
PowerShell
cd folder
deploy
server
```

---

# 24. Safety

Không:

```text
hard-code password
hard-code cookies
extract password
commit browser-data
solve CAPTCHA automatically
bypass Threads security checks
```

Nếu Threads yêu cầu:

```text
2FA
CAPTCHA
security verification
login
```

thì để user xử lý thủ công.

---

# 25. MVP Scope

Chỉ implement:

```text
✓ Text post
✓ Một Threads account
✓ Persistent login
✓ One pending post per run
✓ JSON queue
✓ login.bat
✓ post.bat
✓ Logging
✓ Error handling
✓ Relative/project-root paths
```

Chưa implement:

```text
✗ Image
✗ Video
✗ Carousel
✗ Reply
✗ Multiple account
✗ AI-generated content
✗ Database
✗ Scheduler
✗ Headless mode
```

---

# 26. Debug Screenshot

Nếu automation fail, nên lưu screenshot:

```text
./logs/error-YYYY-MM-DD-HHmmss.png
```

để dễ kiểm tra Threads đã thay đổi UI ở đâu.

---

# 27. Acceptance Criteria

Hoàn thành khi:

1. Antigravity tạo project **trực tiếp trong workspace hiện tại**.
2. Không tạo thêm folder bao ngoài không cần thiết.
3. Không có absolute project path trong source.
4. `npm install` thành công.
5. `login.bat` mở được browser.
6. Login thủ công một lần và session được giữ.
7. `post.bat` chạy mà không cần VS Code.
8. Script tìm đúng pending post.
9. Browser mở Threads đã login.
10. Composer được mở.
11. Nội dung được nhập đúng.
12. Bài được publish.
13. Có bước verify publish.
14. `status` chuyển thành `published`.
15. `publishedAt` được ghi.
16. Chạy lần sau lấy pending post tiếp theo.
17. Session expired không làm mất post.
18. `browser-data/` được ignore.
19. Không có credential Threads trong code.
20. Di chuyển toàn bộ project sang folder Windows khác vẫn chạy được mà không cần sửa source hoặc `.bat`.

---

# 28. Development Instruction for Antigravity

Trước khi code:

1. Xem **current workspace/current working directory**.
2. Coi chính directory đó là project root.
3. Kiểm tra các file hiện có.
4. Không tạo thêm parent folder cho project.
5. Không overwrite file hiện tại nếu chưa kiểm tra.
6. Trình bày ngắn những file dự định tạo hoặc sửa.
7. Chờ approval trước khi thay đổi code.
8. Sau approval mới implement.
9. Sau khi code xong, tự chạy/test các phần có thể test.
10. Không báo hoàn thành nếu chưa verify.

Quan trọng:

> Do not ask the user for a project directory. Use the directory/workspace in which Antigravity is currently running as the project root.

> Do not hard-code the current directory path anywhere. All project paths must remain relative or dynamically resolved.
