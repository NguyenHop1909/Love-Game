# Love Game — Góc nhỏ của tụi mình

Ứng dụng riêng cho hai người: Kahoot, ví phiếu, vòng quay, quà và lịch hẹn, tâm trạng, ý tưởng hẹn hò, nhiệm vụ chung. React + Vite + Supabase.

## Chạy local

Cần Node.js 24 (bộ test dùng API stripTypeScriptTypes của Node).

```sh
npm ci
```

Tạo `.env.local` từ `.env.example`, điền `VITE_SUPABASE_URL` và publishable/anon key. Không đặt service-role key hay Telegram bot token vào biến `VITE_*`.

```sh
npm run dev
npm run lint
npm test
npm run test:e2e
npm run build
```

E2E mặc định dùng Chrome đã cài. Nếu dùng Chromium của Playwright: cài browser bằng `npx playwright install chromium` và bỏ `channel: 'chrome'` trong `playwright.config.js`. E2E dùng Supabase giả lập tại tầng HTTP, không ghi vào dự án thật và không gửi Telegram. Unit/integration test chạy migration, RPC và RLS trên PostgreSQL WASM (PGlite); không thay thế kiểm thử nhiều kết nối trên Supabase staging.

## Nâng cấp dự án đang chạy

Bản này **cần migration backend trước khi phát hành frontend**. Không chỉ merge rồi để Vercel tự deploy lên production: đăng nhập cũ bằng tên/mật khẩu hardcode đã được thay bằng email và Supabase Auth. Luật riêng của hai người được giữ nguyên: số dư thô đúng 9 phiếu được tính là 10 phiếu khi đổi quà. Dữ liệu lịch sử không bị xóa.

1. Sao lưu database và thử trên Supabase staging. Migration giả định các cột hiện có giống code cũ: `quizzes`, `rewards_penalties`, `user_inventory`, `wheel_settings`, `audit_logs`. Nếu có custom enum/check constraint cho trạng thái quà, cần mở rộng chúng cho `Chờ hẹn`, `Đã hẹn`, `Đã thu hồi` trước khi dùng luồng mới. Migration chạy trong transaction; nếu lỗi thì rollback toàn bộ.
2. Tạo hai tài khoản email/password trong Supabase Authentication. Tắt public sign-ups. Tài khoản không có trong `love_members` không được đọc dữ liệu, kể cả đã đăng nhập.
3. Áp dụng `supabase/migrations/202609280001_love_space.sql` bằng SQL Editor, hoặc `supabase link --project-ref <ref>` rồi `supabase db push` nếu lịch sử migration đã đồng bộ. Migration thay các policy của đúng các bảng ứng dụng; kiểm tra policy hiện có và các ứng dụng khác dùng chung dự án trước khi áp dụng.
4. Thêm hai UUID tài khoản vào SQL Editor (role chỉ có đúng một admin và một user):

```sql
insert into public.love_members (user_id, role, display_name) values
  ('UUID_NGUOI_TANG_QUA', 'admin', 'Công chúa'),
  ('UUID_NGUOI_NHAN_QUA', 'user', 'Anh yêu');
```

Role `admin` giao bài/ghi phiếu/hẹn và xác nhận quà; `user` nộp bài/đổi phiếu. Hai người đều dùng góc chung. Tên hiển thị tùy chỉnh được trong bảng này. Quyền do database xác định, không lấy từ localStorage hay user_metadata.

5. Deploy Edge Function `supabase functions deploy notify-partner`. Handler xác minh access token với `auth.getUser()` và membership; không nhận chat ID hay token từ trình duyệt. Đặt secrets trong Supabase Dashboard → Edge Functions → Secrets:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ADMIN_CHAT_ID` (người tặng quà)
   - `TELEGRAM_USER_CHAT_ID` (người nhận quà)
6. Vì bản cũ đưa bot token vào frontend, thu hồi/đổi token cũ qua BotFather, cập nhật token mới ở backend. Xóa các biến `VITE_TELE*` khỏi Vercel. Không đưa token mới vào frontend.
7. Nếu dùng tổng kết theo lịch, đặt GitHub Actions secrets: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_USER_CHAT_ID`. Service-role key chỉ dùng trong GitHub Actions, không nằm trong source hay Vercel frontend. Tổng kết tháng chỉ gửi đúng ngày cuối tháng, kể cả tháng 2 năm nhuận.
8. Đặt hai biến Supabase công khai trên Vercel, build và kiểm tra bằng hai tài khoản trên staging. Sau đó mới chuyển production trong một cửa sổ bảo trì ngắn: RLS mới sẽ ngăn frontend cũ ghi trực tiếp vào ví/quà.

## Những điều cần kiểm tra khi phát hành

- User không truy cập được màn admin; người ngoài không đọc được bảng hoặc ảnh.
- Sửa `localStorage.user_role` không cấp thêm quyền.
- Mở hai tab và đổi quà đồng thời: số dư không âm do chi tiêu vượt mức; một request ID không tạo hai quà. Server dùng advisory transaction lock cho ví và cả thao tác admin.
- Ngắt mạng khi đổi quà, thử lại: dùng lại request ID đã lưu, không trừ lại phiếu.
- Giá quay 0 vẫn là 0; lượt free chỉ giảm một lần. Kết quả server quyết định và quà được lưu trước animation; rời trang không mất quà.
- Quà: chưa sử dụng → chờ hẹn → đã hẹn → đã sử dụng. Chỉ admin hẹn/xác nhận; thu hồi giữ lịch sử và không tự hoàn phiếu.
- Nộp ảnh ≤5 MB (JPG/PNG/WebP); ảnh nằm trong bucket private, xem bằng signed URL 60 giây. Ảnh cũ chưa có `proof_path` cần liên kết thủ công nếu muốn hiển thị lại; link public cũ sẽ ngừng hoạt động khi bucket chuyển private.
- Tắt mạng hoặc Telegram: báo lỗi/trạng thái đúng, không thông báo gửi thành công khi API thất bại.
- Realtime được bật trong migration. Kiểm tra hai thiết bị; focus lại tab hoặc kết nối mạng lại cũng tải mới dữ liệu.

## Kiến trúc và giới hạn

`src/App.jsx` tổ chức các màn hình; `src/lib/useLoveData.js` tải và đồng bộ; `src/lib/domain.js` xử lý ngày VN/số dư/góc quay. RPC giao dịch và RLS trong migration; Telegram ở Edge Function. Audit log do trigger database tạo, người dùng không tự sửa được.

Đây là ứng dụng cho **một cặp đôi**, chưa phải hệ thống nhiều cặp. Nhật ký tải theo từng trang 1.000 dòng để không cắt sai số dư; audit hiển thị 50 mục gần nhất. Ảnh chỉ được kiểm tra MIME/kích thước ở storage; chưa có pipeline xử lý nội dung ảnh. E2E không xác minh delivery Telegram, thông tin đăng nhập thật hay cấu hình RLS đã deploy ở production.

Tài liệu nền tảng: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database functions](https://supabase.com/docs/guides/database/functions), [Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
