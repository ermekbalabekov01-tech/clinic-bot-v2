const pool = require("../db");

async function isSlotTaken(preferredDate, preferredTime) {
  const res = await pool.query(
    `
    SELECT id
    FROM leads
    WHERE preferred_date = $1
      AND preferred_time = $2
      AND status IN ('new', 'booked', 'pending_confirmation')
    LIMIT 1
    `,
    [preferredDate, preferredTime]
  );

  return res.rows.length > 0;
}

async function createLead({
  clientId,
  serviceKey,
  serviceTitle,
  city,
  photoNeeded = false,
  photoReceived = false,
  photoMediaId = null,
  preferredDate,
  preferredTime,
  status = "pending_confirmation",
}) {
  const result = await pool.query(
    `
    INSERT INTO leads (
      client_id,
      service_key,
      service_title,
      city,
      photo_needed,
      photo_received,
      photo_media_id,
      preferred_date,
      preferred_time,
      status,
      source,
      created_at,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'whatsapp',NOW(),NOW())
    RETURNING *
    `,
    [
      clientId,
      serviceKey,
      serviceTitle,
      city,
      photoNeeded,
      photoReceived,
      photoMediaId,
      preferredDate,
      preferredTime,
      status,
    ]
  );

  return result.rows[0];
}

module.exports = {
  isSlotTaken,
  createLead,
};