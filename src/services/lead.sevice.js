const pool = require("../db");

async function createLead({
  clientId,
  serviceKey = "consultation",
  serviceTitle = "Первичная консультация",
  branch = "astana",
  status = "new",
}) {
  const result = await pool.query(
    `
    INSERT INTO leads (
      client_id,
      service_key,
      service_title,
      branch,
      status,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING *
    `,
    [clientId, serviceKey, serviceTitle, branch, status]
  );

  return result.rows[0];
}

module.exports = {
  createLead,
};