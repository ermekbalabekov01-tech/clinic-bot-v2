const pool = require("../db");

async function getSession(phone) {
  const res = await pool.query(
    "SELECT * FROM sessions WHERE phone = $1",
    [phone]
  );
  return res.rows[0] || null;
}

async function setSession(phone, step, payload = {}) {
  const payloadJson = JSON.stringify(payload);

  await pool.query(
    `
    INSERT INTO sessions (phone, step, payload_json, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (phone)
    DO UPDATE SET
      step = EXCLUDED.step,
      payload_json = EXCLUDED.payload_json,
      updated_at = NOW()
    `,
    [phone, step, payloadJson]
  );
}

async function clearSession(phone) {
  await pool.query("DELETE FROM sessions WHERE phone = $1", [phone]);
}

module.exports = {
  getSession,
  setSession,
  clearSession,
};