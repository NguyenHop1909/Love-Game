import { createClient } from '@supabase/supabase-js';

// Lấy thông tin cấu hình bảo mật từ file .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Khởi tạo kết nối đến database Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Hàm gửi thông báo qua Telegram Bot (Lách luật CORS bằng cơ chế Image)
 * @param {string} chatId - ID Telegram của người nhận
 * @param {string} message - Nội dung tin nhắn
 */
export const sendTelegramNotification = (chatId, message) => {
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    
    // Mã hóa tin nhắn để khi truyền lên URL không bị lỗi ký tự đặc biệt hoặc font tiếng Việt
    const encodedMessage = encodeURIComponent(message);
    
    // Tạo đường dẫn API Telegram theo phương thức GET công khai
    const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodedMessage}&parse_mode=Markdown`;
    
    // Dùng mẹo tạo một đối tượng Image ẩn để bắt trình duyệt kích hoạt URL mà không bị chặn CORS
    const img = new Image();
    img.src = url;
    
    console.log("🚀 Đã kích hoạt lệnh bắn tin nhắn ẩn qua Telegram!");
};

// Thêm hàm này vào cuối file src/supabaseClient.js
export const sendTelegramPhoto = async (chatId, photoUrl, caption) => {
  const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'Markdown'
      })
    });
  } catch (error) {
    console.error('Lỗi gửi ảnh Telegram:', error);
  }
};