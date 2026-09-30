import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://clrqxwhbbkfinczhqvqr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscnF4d2hiYmtmaW5jemhxdnFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2OTM2MzgsImV4cCI6MjEwNjI2OTYzOH0.sB5cqdE-rhKWKiM7jmdYKCQsV5WJkQPiB2MesxsYnLw';

const supabase = createClient(supabaseUrl, supabaseKey);

const dummyOrders = [
  {
    customer_name: 'Anh Tuấn', phone: '0901234567',
    address: '123 Phạm Văn Đồng, Phường 3, Gò Vấp, Hồ Chí Minh',
    product: '2 Áo thun nam', total_amount: 300000, deposit: 0, shipping_fee: 20000, cod: 320000,
    shipping_unit: 'Tự Lấy', platform: 'FB', status: 'pending'
  },
  {
    customer_name: 'Chị Mai', phone: '0987654321',
    address: '45 Nguyễn Kiệm, Phường 3, Gò Vấp, Hồ Chí Minh',
    product: '1 Váy công sở', total_amount: 450000, deposit: 100000, shipping_fee: 15000, cod: 365000,
    shipping_unit: 'Tự Lấy', platform: 'IG', status: 'pending'
  },
  {
    customer_name: 'Chú Hoàng', phone: '0912345678',
    address: '89 Nguyễn Thái Sơn, Phường 4, Gò Vấp, Hồ Chí Minh',
    product: '1 Cặp táp', total_amount: 600000, deposit: 0, shipping_fee: 25000, cod: 625000,
    shipping_unit: 'Tự Lấy', platform: 'Threads', status: 'pending'
  },
  {
    customer_name: 'Bé Linh', phone: '0909888777',
    address: '12 Hoàng Minh Giám, Phường 9, Phú Nhuận, Hồ Chí Minh',
    product: '5 Ốp lưng đt', total_amount: 250000, deposit: 250000, shipping_fee: 0, cod: 0,
    shipping_unit: 'Tự Lấy', platform: 'Tiktok', status: 'pending'
  },
  {
    customer_name: 'Anh Phát', phone: '0933222111',
    address: '200 Quang Trung, Phường 10, Gò Vấp, Hồ Chí Minh',
    product: '3 Đôi vớ', total_amount: 90000, deposit: 0, shipping_fee: 15000, cod: 105000,
    shipping_unit: 'Tự Lấy', platform: 'FB', status: 'pending'
  }
];

async function insertData() {
  const { data, error } = await supabase.from('orders').insert(dummyOrders);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Inserted successfully!');
  }
}

insertData();
