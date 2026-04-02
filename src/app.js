const express = require("express");
require("dotenv").config();

const pool = require("./db");
const whatsappRoutes = require("./routes/whatsapp.routes");

const app = express();

app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Clinic Bot v2 is running");
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      ok: true,
      time: result.rows[0],
    });
  } catch (err) {
    console.error("DB TEST ERROR:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.use("/", whatsappRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});