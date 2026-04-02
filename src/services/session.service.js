const pool = require("../db");

// получить сессию
async function getSession(phone) {
  const res = await pool.query(
    "SELECT * FROM sessions WHERE phone = $1",
    [phone]
  );

  if (res.rows.length === 0) return null;
  return res.rows[0];
}

// создать или обновить
async function setSession(phone, step, payload = {}) {
  const payloadJson = JSON.stringify(payload);

  await pool.query(
    `
    INSERT INTO sessions (phone, step, payload_json)
    VALUES ($1, $2, $3)
    ON CONFLICT (phone)
    DO UPDATE SET 
      step = EXCLUDED.step,
      payload_json = EXCLUDED.payload_json,
      updated_at = NOW()
  `,
    [phone, step, payloadJson]
  );
}

// удалить (после завершения записи)
async function clearSession(phone) {
  await pool.query("DELETE FROM sessions WHERE phone = $1", [phone]);
}

module.exports = {
  getSession,
  setSession,
  clearSession,
};