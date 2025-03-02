require('dotenv').config();
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const axios = require('axios');

const url = process.env.URL;
const expectedPricePrefix = process.env.EXPECTED_PRICE_PREFIX;
const whatsappApiUrl = process.env.WHATSAPP_API_URL;
const whatsappNumber = process.env.WHATSAPP_NUMBER;
const apiKey = process.env.API_KEY;

async function sendWhatsAppMessage(message) {
  try {
    await axios.get(whatsappApiUrl, {
      params: {
        phone: whatsappNumber,
        text: message,
        apikey: apiKey,
      },
    });
    console.log('WhatsApp-Benachrichtigung gesendet:', message);
  } catch (error) {
    console.error('Fehler beim Senden der WhatsApp-Nachricht:', error);
  }
}

async function checkPrice() {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const dom = new JSDOM(text);

    const priceElement = dom.window.document.querySelector('text.nbb-svg-base');
    if (priceElement) {
      const priceText = priceElement.textContent.trim();
      if (!priceText.startsWith(expectedPricePrefix)) {
        console.log('Preis hat sich geändert:', priceText);
        sendWhatsAppMessage(`Preisänderung! Neuer Preis: ${priceText}`);
      } else {
        console.log('Preis unverändert:', priceText);
      }
    } else {
      console.error('Preis konnte nicht gefunden werden.');
    }
  } catch (error) {
    console.error('Fehler beim Abrufen der Seite:', error);
  }
}

setInterval(checkPrice, 60 * 60 * 1000);

checkPrice();
