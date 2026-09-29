const { Client } = require('pg');

const connectionString = "postgresql://postgres.clrqxwhbbkfinczhqvqr:RuugM0P1Vo0zQQHx@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";

const client = new Client({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    const query = `ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_deleted boolean default false;`;
    await client.query(query);
    console.log("Đã thêm cột is_deleted (xóa mềm) thành công!");
  } catch (error) {
    console.error("Lỗi:", error.message);
  } finally {
    await client.end();
  }
}

run();
