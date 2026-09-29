import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const sampleOrders = [
  {
    customer_name: "Bảo Ngân",
    phone: "0842270712",
    address: "137 Đặng Thái Thân, P. Thanh Vinh, tp Vinh, Nghệ An",
    product: "1 lạc giòn 50K\n1 cheese 8cm 85K\n1 măng cụt vsl 50K",
    total_amount: 185000,
    deposit: 185000,
    shipping_fee: 14000,
    cod: 14000,
    shipping_unit: "SPX",
    platform: "Threads",
    notes: ""
  },
  {
    customer_name: "Quân",
    phone: "0948896556",
    address: "",
    product: "1 măng cụt vsl 50K",
    total_amount: 50000,
    deposit: 25000,
    shipping_fee: 0,
    cod: 25000,
    shipping_unit: "Tự Lấy",
    platform: "Khác",
    notes: "Mai ghé cty lấy tầm 10h"
  },
  {
    customer_name: "B. Quyên",
    phone: "0795663172",
    address: "19/21 Lê Đình Thám",
    product: "1 cheese vsl 8cm 85K",
    total_amount: 85000,
    deposit: 25000,
    shipping_fee: 0,
    cod: 60000,
    shipping_unit: "Khác",
    platform: "Khác",
    notes: ""
  },
  {
    customer_name: "Ngọc Hà",
    phone: "0862038482",
    address: "",
    product: "1 Butter chậm tăng 25K",
    total_amount: 25000,
    deposit: 0,
    shipping_fee: 0,
    cod: 25000,
    shipping_unit: "Tự Lấy",
    platform: "Khác",
    notes: "Gửi c Như, Chưa CK"
  },
  {
    customer_name: "Thảo Quyên",
    phone: "0908542047",
    address: "39 LX/ Khu phố Long Phượng, xã Long Điền, BRVT, TP.HCM",
    product: "1 dưa đá bào đỏ 40\n1 xà phòng giòn xanh 50K",
    total_amount: 90000,
    deposit: 30000,
    shipping_fee: 14000,
    cod: 74000,
    shipping_unit: "SPX",
    platform: "FB",
    notes: ""
  }
];

async function insertSamples() {
  console.log("Đang tải dữ liệu mẫu lên Supabase...");
  const { data, error } = await supabase.from('orders').insert(sampleOrders).select();
  if (error) {
    console.error("Lỗi:", error.message);
  } else {
    console.log("✅ Đã tạo thành công 5 đơn hàng mẫu!");
  }
}

insertSamples();
