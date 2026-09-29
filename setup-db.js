const { Client } = require('pg');

const connectionString = "postgresql://postgres.clrqxwhbbkfinczhqvqr:RuugM0P1Vo0zQQHx@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";

const client = new Client({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Đang kết nối đến Database để tạo bảng...");
    await client.connect();
    const query = `
      create table if not exists orders (
        id uuid default gen_random_uuid() primary key,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null,
        customer_name text not null,
        phone text,
        address text,
        product text not null,
        price numeric default 0,
        status text default 'pending',
        notes text
      );
      alter table orders disable row level security;
    `;
    await client.query(query);
    console.log("✅ Đã tạo bảng 'orders' thành công trên Supabase!");
  } catch (error) {
    console.error("Lỗi:", error.message);
  } finally {
    await client.end();
  }
}

run();
