const axios = require("axios");

const WHATSAPP_API = "https://graph.facebook.com/v18.0";

async function sendTextMessage(to, text) {
  const url = `${WHATSAPP_API}/${process.env.PHONE_NUMBER_ID}/messages`;

  const response = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: text,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

module.exports = {
  sendTextMessage,
};