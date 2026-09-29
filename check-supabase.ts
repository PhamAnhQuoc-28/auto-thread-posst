import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.error("Không tìm thấy VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong file .env");
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

if (supabaseUrl === 'nhap_url_cua_ban_vao_day' || supabaseKey === 'nhap_anon_key_cua_ban_vao_day') {
  console.error("Bạn chưa thay thế thông tin mẫu bằng thông tin thật của Supabase.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Đang kết nối đến Supabase...");
  const { data, error } = await supabase.from('orders').select('*').limit(1);
  if (error) {
    console.error("Kết nối thất bại. Lỗi:", error.message);
    process.exit(1);
  }
  console.log("✅ Kết nối thành công! Bảng orders đã sẵn sàng hoạt động.");
}

check();
