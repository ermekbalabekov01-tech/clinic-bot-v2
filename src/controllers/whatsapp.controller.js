const { getSession, setSession } = require("../services/session.service");
const { sendTextMessage } = require("../services/whatsapp.service");

async function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

async function handleWebhook(req, res) {
  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const phone = message.from;
    const text =
      message.type === "text"
        ? String(message.text?.body || "").trim()
        : "";

    console.log("PHONE:", phone);
    console.log("TEXT:", text);

    let session = await getSession(phone);

    if (!session) {
      await setSession(phone, "ask_city", {});

      await sendTextMessage(
        phone,
        "Здравствуйте! 🌸 Меня зовут Алия.\n\nПодскажите, пожалуйста, из какого вы города?"
      );

      return res.sendStatus(200);
    }

    let payload = {};
    try {
      payload = session.payload_json ? JSON.parse(session.payload_json) : {};
    } catch (e) {
      payload = {};
    }

    if (session.step === "ask_city") {
      await setSession(phone, "ask_name_age", {
        ...payload,
        city: text,
      });

      await sendTextMessage(
        phone,
        "Благодарю 🌿\n\nПодскажите, пожалуйста, как я могу к вам обращаться и ваш возраст?"
      );

      return res.sendStatus(200);
    }

    if (session.step === "ask_name_age") {
      await setSession(phone, "done", {
        ...payload,
        name_age: text,
      });

      await sendTextMessage(
        phone,
        "Спасибо! 😊\n\nВы можете прийти на бесплатную консультацию."
      );

      return res.sendStatus(200);
    }

    await sendTextMessage(
      phone,
      "Если хотите начать заново, напишите: Привет"
    );

    return res.sendStatus(200);
  } catch (error) {
    console.error("WEBHOOK ERROR:", error.response?.data || error.message);
    return res.sendStatus(500);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};