const fs = require("fs");
const path = require("path");
const pool = require("./index");
require("dotenv").config();

async function initDb() {
  try {
    const sqlPath = path.join(__dirname, "init.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    await pool.query(sql);
    console.log("✅ Tables created successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ DB init error:", err.message);
    process.exit(1);
  }
}

initDb();