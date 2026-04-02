const { getSession, setSession, clearSession } = require("../services/session.service");
const { sendTextMessage } = require("../services/whatsapp.service");
const { upsertClient } = require("../services/client.service");
const { createLead } = require("../services/lead.service");

function normalizeText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isRestartCommand(text) {
  const t = normalizeText(text);
  return (
    t === "привет" ||
    t === "здравствуйте" ||
    t === "заново" ||
    t === "начать заново" ||
    t === "/start" ||
    t === "старт"
  );
}

function parseNameAndAge(text) {
  const cleaned = String(text || "").trim();

  const ageMatch = cleaned.match(/(\d{1,2})/);
  const age = ageMatch ? Number(ageMatch[1]) : null;

  let name = cleaned
    .replace(/\d{1,2}\s*(лет|год|года)?/gi, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) name = cleaned;

  return { name, age };
}

async function startFlow(phone) {
  await clearSession(phone);
  await setSession(phone, "ask_city", {});

  await sendTextMessage(
    phone,
    "Здравствуйте! 🌸\n" +
      "Меня зовут Алия.\n\n" +
      "Вы обратились в клинику Dr.Aitimbetova.\n" +
      "С радостью помогу Вам с подбором процедуры и записью.\n\n" +
      "Подскажите, пожалуйста, из какого Вы города?"
  );
}

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
    if (!message) return res.sendStatus(200);

    const phone = message.from;
    const text =
      message.type === "text"
        ? String(message.text?.body || "").trim()
        : "";

    console.log("PHONE:", phone);
    console.log("TEXT:", text);

    // Всегда первым делом ловим команду перезапуска
    if (isRestartCommand(text)) {
      console.log("RESTART_TRIGGERED");
      await startFlow(phone);
      return res.sendStatus(200);
    }

    const session = await getSession(phone);

    // Если сессии нет, просто мягко запускаем сценарий заново
    if (!session) {
      await startFlow(phone);
      return res.sendStatus(200);
    }

    let payload = {};
    try {
      payload = session.payload_json ? JSON.parse(session.payload_json) : {};
    } catch {
      payload = {};
    }

    if (session.step === "ask_city") {
      await setSession(phone, "ask_name_age", {
        ...payload,
        city: text,
      });

      await sendTextMessage(
        phone,
        "Благодарю 🌿\n\n" +
          "Подскажите, пожалуйста, как я могу к Вам обращаться и Ваш возраст?\n\n" +
          "Например: Ермек 36 лет"
      );

      return res.sendStatus(200);
    }

    if (session.step === "ask_name_age") {
      const { name, age } = parseNameAndAge(text);

      const client = await upsertClient({
        phone,
        name,
        age,
        city: payload.city || null,
      });

      if (!client || !client.id) {
        await sendTextMessage(
          phone,
          "Произошла техническая ошибка.\n" +
            "Пожалуйста, напишите ещё раз: Привет"
        );
        return res.sendStatus(200);
      }

      await createLead({
        clientId: client.id,
        serviceKey: "consultation",
        serviceTitle: "Первичная консультация",
        branch: "astana",
        status: "new",
      });

      // Убираем сессию, чтобы не было цикла
      await clearSession(phone);

      await sendTextMessage(
        phone,
        `Спасибо, ${name}! 😊\n\n` +
          "Вы можете прийти на бесплатную консультацию, где специалист подробно всё посмотрит и подберёт подходящее решение.\n\n" +
          "Если захотите оформить новую заявку или начать заново, просто напишите: Привет"
      );

      return res.sendStatus(200);
    }

    // Если шаг непонятный — спокойно начинаем сначала
    await startFlow(phone);
    return res.sendStatus(200);

  } catch (error) {
    console.error("WEBHOOK ERROR FULL:", error);
    return res.sendStatus(500);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};
