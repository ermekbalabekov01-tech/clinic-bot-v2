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
  return [
    "привет",
    "здравствуйте",
    "заново",
    "начать заново",
    "старт",
    "/start"
  ].includes(t);
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

  if (!name) {
    name = cleaned;
  }

  return { name, age };
}

async function startFlow(phone) {
  await clearSession(phone);
  await setSession(phone, "ask_city", {});

  await sendTextMessage(
    phone,
    "Здравствуйте! 🌸 Меня зовут Алия.\n\nПодскажите, пожалуйста, из какого вы города?"
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

    // 1. Любая команда перезапуска ловится СРАЗУ, до чтения step
    if (isRestartCommand(text)) {
      await startFlow(phone);
      return res.sendStatus(200);
    }

    // 2. Получаем сессию
    let session = await getSession(phone);

    // 3. Если сессии нет — стартуем
    if (!session) {
      await startFlow(phone);
      return res.sendStatus(200);
    }

    let payload = {};
    try {
      payload = session.payload_json ? JSON.parse(session.payload_json) : {};
    } catch (e) {
      payload = {};
    }

    // 4. Шаг: город
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

    // 5. Шаг: имя и возраст
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
          "Произошла техническая ошибка. Пожалуйста, напишите: Привет"
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

      await setSession(phone, "done", {
        ...payload,
        name,
        age,
      });

      await sendTextMessage(
        phone,
        `Спасибо, ${name}! 😊\n\nВы можете прийти на бесплатную консультацию.\n\nЧтобы начать новую заявку, просто напишите: Привет`
      );

      return res.sendStatus(200);
    }

    // 6. Если шаг done — не спорим, а мягко перезапускаем по любой новой реплике
    if (session.step === "done") {
      await sendTextMessage(
        phone,
        "Чтобы начать новую заявку, напишите: Привет"
      );
      return res.sendStatus(200);
    }

    // 7. Фоллбек
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