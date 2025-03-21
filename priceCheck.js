require('dotenv').config();
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const https = require('https');
const querystring = require('querystring');

const url = process.env.URL;
const article = process.env.ARTICLE;
const pushoverToken = process.env.TOKEN;
const pushoverUser = process.env.USER;
const targetPrice = parseFloat(
  process.env.EXPECTED_PRICE_PREFIX.replace(',', '.')
);

function send_push_notification(message, priority = '1') {
  if (!pushoverToken || !pushoverUser) {
    const error_message =
      '⚠️ TOKEN oder USER nicht gesetzt. Bitte überprüfe deine Umgebungsvariablen.';
    console.error(error_message);
    return;
  }

  const current_time = new Date().toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const full_message = `${message}\n🕒 ${current_time}`;

  const postData = querystring.stringify({
    token: pushoverToken,
    user: pushoverUser,
    title: 'Preisalarm',
    message: full_message,
    priority: priority,
    sound: 'magic',
  });

  const options = {
    hostname: 'api.pushover.net',
    port: 443,
    path: '/1/messages.json',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const req = https.request(options, (res) => {
    let response = '';
    res.on('data', (chunk) => {
      response += chunk;
    });
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Push-Nachricht erfolgreich gesendet!');
      } else {
        console.error(
          `❌ Fehler beim Senden: ${res.statusCode}, Antwort: ${response}`
        );
      }
    });
  });

  req.on('error', (e) => {
    console.error(`❌ Fehler bei der Verbindung: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

async function getCurrentPrice() {
  const response = await fetch(url);
  const text = await response.text();
  const dom = new JSDOM(text);

  const priceElement = dom.window.document.querySelector('text.nbb-svg-base');
  if (!priceElement) {
    throw new Error('⚠️ Preis konnte nicht gefunden werden.');
  }

  const rawPrice = priceElement.textContent.trim();
  const numericPrice = parseFloat(
    rawPrice.replace(/[^\d,]/g, '').replace(',', '.')
  );

  return { rawPrice, numericPrice };
}

async function checkPrice() {
  try {
    const { rawPrice, numericPrice } = await getCurrentPrice();

    console.log(
      `💰 Gefundener Preis: ${numericPrice} € | Zielpreis: ${targetPrice} €`
    );

    if (numericPrice < targetPrice) {
      send_push_notification(
        `🎉 Der Preis von "${article}" ist gefallen!\nNeuer Preis: ${rawPrice}`, "2"
      );
    } else {
      console.log(
        `ℹ️ Preis ist noch zu hoch (${numericPrice} €) – keine Nachricht.`
      );
    }
  } catch (error) {
    console.error(error.message);
    send_push_notification(`❌ Fehler beim Preisabruf: ${error.message}`);
  }
}

async function sendDailyStatus() {
  try {
    const { rawPrice } = await getCurrentPrice();

    const message = `📋 Täglicher Preis-Check für "${article}"\nAktueller Preis: ${rawPrice} €`;
    send_push_notification(message);
  } catch (error) {
    console.error(error.message);
    send_push_notification(`❌ Fehler beim täglichen Check: ${error.message}`);
  }
}

function isBetweenHours(startHour, endHour) {
  const now = new Date();
  const currentHour = now.getHours();
  return currentHour >= startHour && currentHour < endHour;
}

checkPrice();

if (isBetweenHours(14, 17)) {
  console.log(
    '🕒 Script läuft im täglichen Zeitfenster → Sende tägliche Statusmeldung.'
  );
  sendDailyStatus();
} else {
  console.log('ℹ️ Script läuft außerhalb des täglichen Push-Zeitfensters.');
}
