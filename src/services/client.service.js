const pool = require("../db");

async function upsertClient({ phone, name = null, age = null, city = null }) {
  const existing = await pool.query(
    "SELECT * FROM clients WHERE phone = $1",
    [phone]
  );

  if (existing.rows.length > 0) {
    const updated = await pool.query(
      `
      UPDATE clients
      SET
        name = COALESCE($2, name),
        age = COALESCE($3, age),
        city = COALESCE($4, city),
        updated_at = NOW()
      WHERE phone = $1
      RETURNING *
      `,
      [phone, name, age, city]
    );
    return updated.rows[0];
  }

  const inserted = await pool.query(
    `
    INSERT INTO clients (phone, name, age, city, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING *
    `,
    [phone, name, age, city]
  );

  return inserted.rows[0];
}

module.exports = {
  upsertClient,
};