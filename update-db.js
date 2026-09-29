const { Client } = require('pg');

const connectionString = "postgresql://postgres.clrqxwhbbkfinczhqvqr:RuugM0P1Vo0zQQHx@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";

const client = new Client({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    // Đổi tên cột price -> total_amount, thêm các cột mới
    const query = `
      ALTER TABLE orders RENAME COLUMN price TO total_amount;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit numeric default 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee numeric default 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod numeric default 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_unit text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform text;
    `;
    await client.query(query);
    console.log("Cập nhật Database thành công!");
  } catch (error) {
    console.error("Lỗi:", error.message);
  } finally {
    await client.end();
  }
}

run();
