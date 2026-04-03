const { getSession, setSession, clearSession } = require("../services/session.service");
const { upsertClient } = require("../services/client.service");
const { createLead, isSlotTaken } = require("../services/lead.service");
const {
  sendTextMessage,
  sendReplyButtons,
  sendListMessage,
} = require("../services/whatsapp.service");

const SERVICES = [
  {
    id: "service_hair",
    key: "hair",
    title: "Пересадка волос",
    needPhoto: true,
  },
  {
    id: "service_brows",
    key: "brows",
    title: "Пересадка бровей",
    needPhoto: true,
  },
  {
    id: "service_lashes",
    key: "lashes",
    title: "Пересадка ресниц",
    needPhoto: true,
  },
  {
    id: "service_beard",
    key: "beard",
    title: "Пересадка бороды",
    needPhoto: true,
  },
];

const DEFAULT_SLOTS = [
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
];

function normalizeText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isRestartCommand(text) {
  const t = normalizeText(text);
  return ["привет", "здравствуйте", "заново", "начать заново", "/start", "старт"].includes(t);
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

function getIncomingValue(message) {
  if (!message) return { type: "unknown", text: "", id: "" };

  if (message.type === "text") {
    return {
      type: "text",
      text: String(message.text?.body || "").trim(),
      id: "",
    };
  }

  if (message.type === "interactive") {
    const interactive = message.interactive || {};

    if (interactive.button_reply) {
      return {
        type: "button",
        text: String(interactive.button_reply.title || "").trim(),
        id: String(interactive.button_reply.id || "").trim(),
      };
    }

    if (interactive.list_reply) {
      return {
        type: "list",
        text: String(interactive.list_reply.title || "").trim(),
        id: String(interactive.list_reply.id || "").trim(),
      };
    }
  }

  if (message.type === "image") {
    return {
      type: "image",
      text: "",
      id: String(message.image?.id || "").trim(),
    };
  }

  return { type: message.type || "unknown", text: "", id: "" };
}

function getDateOptions(days = 7) {
  const items = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);

    const iso = d.toISOString().slice(0, 10);

    const label = d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });

    items.push({
      id: `date_${iso}`,
      title: label,
      description: "Выбрать эту дату",
    });
  }

  return items;
}

function buildServicesSection() {
  return [
    {
      title: "Выберите услугу",
      rows: SERVICES.map((s) => ({
        id: s.id,
        title: s.title.slice(0, 24),
        description: "Открыть запись",
      })),
    },
  ];
}

function buildDatesSection() {
  return [
    {
      title: "Свободные даты",
      rows: getDateOptions(7).map((d) => ({
        id: d.id,
        title: d.title.slice(0, 24),
        description: d.description,
      })),
    },
  ];
}

function buildTimesSection() {
  return [
    {
      title: "Свободное время",
      rows: DEFAULT_SLOTS.map((t) => ({
        id: `time_${t.replace(":", "_")}`,
        title: t,
        description: "Выбрать это время",
      })),
    },
  ];
}

function getServiceById(serviceId) {
  return SERVICES.find((s) => s.id === serviceId) || null;
}

async function startFlow(phone) {
  await clearSession(phone);
  await setSession(phone, "ask_city", {});

  await sendReplyButtons(
    phone,
    "Здравствуйте! 🌸\nМеня зовут Алия.\n\nВы обратились в клинику Dr.Aitimbetova.\nС радостью помогу Вам с подбором процедуры и записью.\n\nПодскажите, пожалуйста, из какого Вы города?",
    [
      { id: "city_astana", title: "Астана" },
      { id: "city_other", title: "Другой город" },
    ],
    null,
    "Можно выбрать кнопкой"
  );
}

async function askService(phone) {
  await sendListMessage(
    phone,
    "Подскажите, пожалуйста, какая процедура Вас интересует?",
    "Выбрать услугу",
    buildServicesSection(),
    null,
    "Выберите один вариант"
  );
}

async function askPhotoChoice(phone, serviceTitle) {
  await sendReplyButtons(
    phone,
    `Чтобы я могла точнее сориентировать Вас по процедуре "${serviceTitle}", можете отправить фото зоны без лица.\n\nЕсли сейчас неудобно — можно продолжить без фото.`,
    [
      { id: "photo_yes", title: "Отправить фото" },
      { id: "photo_no", title: "Без фото" },
    ]
  );
}

async function askNameAge(phone) {
  await sendTextMessage(
    phone,
    "Благодарю 🌿\n\nПодскажите, пожалуйста, как я могу к Вам обращаться и Ваш возраст?\n\nНапример: Ермек 36 лет"
  );
}

async function askDate(phone) {
  await sendListMessage(
    phone,
    "Выберите, пожалуйста, удобный день для консультации.",
    "Выбрать дату",
    buildDatesSection(),
    null,
    "Покажу доступные даты"
  );
}

async function askTime(phone, chosenDateLabel) {
  await sendListMessage(
    phone,
    `На ${chosenDateLabel} доступно свободное время.\n\nВыберите, пожалуйста, удобный вариант.`,
    "Выбрать время",
    buildTimesSection(),
    null,
    "Если слот занят, предложу выбрать другой"
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
    const incoming = getIncomingValue(message);

    console.log("PHONE:", phone);
    console.log("INCOMING_TYPE:", incoming.type);
    console.log("INCOMING_TEXT:", incoming.text);
    console.log("INCOMING_ID:", incoming.id);

    if (incoming.type === "text" && isRestartCommand(incoming.text)) {
      await startFlow(phone);
      return res.sendStatus(200);
    }

    let session = await getSession(phone);

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

    // ГОРОД
    if (session.step === "ask_city") {
      if (incoming.id === "city_astana") {
        payload.city = "Астана";
      } else if (incoming.id === "city_other") {
        await setSession(phone, "ask_city_manual", payload);
        await sendTextMessage(
          phone,
          "Подскажите, пожалуйста, напишите Ваш город вручную."
        );
        return res.sendStatus(200);
      } else if (incoming.type === "text") {
        payload.city = incoming.text;
      } else {
        await sendTextMessage(phone, "Пожалуйста, выберите город кнопкой или напишите его сообщением.");
        return res.sendStatus(200);
      }

      await setSession(phone, "ask_service", payload);
      await askService(phone);
      return res.sendStatus(200);
    }

    if (session.step === "ask_city_manual") {
      if (incoming.type !== "text") {
        await sendTextMessage(phone, "Пожалуйста, напишите название города текстом.");
        return res.sendStatus(200);
      }

      payload.city = incoming.text;
      await setSession(phone, "ask_service", payload);
      await askService(phone);
      return res.sendStatus(200);
    }

    // УСЛУГА
    if (session.step === "ask_service") {
      const service = getServiceById(incoming.id);

      if (!service) {
        await sendTextMessage(phone, "Пожалуйста, выберите услугу из списка.");
        await askService(phone);
        return res.sendStatus(200);
      }

      payload.serviceKey = service.key;
      payload.serviceTitle = service.title;
      payload.photoNeeded = service.needPhoto;

      await setSession(phone, "ask_photo_choice", payload);
      await askPhotoChoice(phone, service.title);
      return res.sendStatus(200);
    }

    // ФОТО / БЕЗ ФОТО
    if (session.step === "ask_photo_choice") {
      if (incoming.id === "photo_yes") {
        payload.photoNeeded = true;
        await setSession(phone, "wait_photo", payload);
        await sendTextMessage(
          phone,
          "Хорошо 🌿\n\nОтправьте, пожалуйста, фото зоны без лица.\nПосле этого я продолжу запись."
        );
        return res.sendStatus(200);
      }

      if (incoming.id === "photo_no") {
        payload.photoNeeded = false;
        payload.photoReceived = false;
        await setSession(phone, "ask_name_age", payload);
        await askNameAge(phone);
        return res.sendStatus(200);
      }

      await sendTextMessage(phone, "Пожалуйста, выберите один из вариантов: отправить фото или без фото.");
      return res.sendStatus(200);
    }

    if (session.step === "wait_photo") {
      if (incoming.type !== "image") {
        await sendTextMessage(
          phone,
          "Я ожидаю фото зоны.\nЕсли хотите продолжить без фото, напишите: Привет"
        );
        return res.sendStatus(200);
      }

      payload.photoReceived = true;
      payload.photoMediaId = incoming.id;

      await setSession(phone, "ask_name_age", payload);
      await sendTextMessage(phone, "Спасибо, фото получила ✅");
      await askNameAge(phone);
      return res.sendStatus(200);
    }

    // ИМЯ И ВОЗРАСТ
    if (session.step === "ask_name_age") {
      if (incoming.type !== "text") {
        await sendTextMessage(phone, "Пожалуйста, напишите имя и возраст сообщением.\nНапример: Ермек 36 лет");
        return res.sendStatus(200);
      }

      const { name, age } = parseNameAndAge(incoming.text);

      const client = await upsertClient({
        phone,
        name,
        age,
        city: payload.city || null,
      });

      payload.clientId = client.id;
      payload.name = name;
      payload.age = age;

      await setSession(phone, "ask_date", payload);
      await askDate(phone);
      return res.sendStatus(200);
    }

    // ДАТА
    if (session.step === "ask_date") {
      if (!incoming.id.startsWith("date_")) {
        await sendTextMessage(phone, "Пожалуйста, выберите дату из списка.");
        await askDate(phone);
        return res.sendStatus(200);
      }

      const isoDate = incoming.id.replace("date_", "");
      payload.preferredDate = isoDate;
      payload.preferredDateLabel = incoming.text || isoDate;

      await setSession(phone, "ask_time", payload);
      await askTime(phone, payload.preferredDateLabel);
      return res.sendStatus(200);
    }

    // ВРЕМЯ
    if (session.step === "ask_time") {
      if (!incoming.id.startsWith("time_")) {
        await sendTextMessage(phone, "Пожалуйста, выберите время из списка.");
        await askTime(phone, payload.preferredDateLabel || payload.preferredDate);
        return res.sendStatus(200);
      }

      const time = incoming.id.replace("time_", "").replace("_", ":");

      const taken = await isSlotTaken(payload.preferredDate, time);
      if (taken) {
        await sendTextMessage(
          phone,
          "Это время уже занято. Пожалуйста, выберите другой свободный вариант."
        );
        await askTime(phone, payload.preferredDateLabel || payload.preferredDate);
        return res.sendStatus(200);
      }

      await createLead({
        clientId: payload.clientId,
        serviceKey: payload.serviceKey,
        serviceTitle: payload.serviceTitle,
        city: payload.city,
        photoNeeded: Boolean(payload.photoNeeded),
        photoReceived: Boolean(payload.photoReceived),
        photoMediaId: payload.photoMediaId || null,
        preferredDate: payload.preferredDate,
        preferredTime: time,
        status: "pending_confirmation",
      });

      await clearSession(phone);

      await sendTextMessage(
        phone,
        `Спасибо, ${payload.name}! 😊\n\n` +
          `Ваша предварительная запись оформлена:\n` +
          `• Город: ${payload.city}\n` +
          `• Услуга: ${payload.serviceTitle}\n` +
          `• Дата: ${payload.preferredDateLabel}\n` +
          `• Время: ${time}\n\n` +
          `Администратор подтвердит запись в ближайшее время.\n\n` +
          `Если захотите оформить новую заявку, просто напишите: Привет`
      );

      return res.sendStatus(200);
    }

    await startFlow(phone);
    return res.sendStatus(200);
  } catch (error) {
    console.error("WEBHOOK ERROR FULL:", error.response?.data || error.message || error);
    return res.sendStatus(500);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};
