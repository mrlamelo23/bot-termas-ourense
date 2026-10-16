// bot_rio.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignora los certificados a nivel global

const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

async function actualizarNivelRio() {
  try {
    console.log("🌊 Iniciando lectura del SAIH con soporte de cookies...");

    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("La variable de entorno FIREBASE_SERVICE_ACCOUNT no está definida.");
    }

    let serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://termas-ourense-77efb-default-rtdb.europe-west1.firebasedatabase.app"
      });
    }

    const db = admin.database();
    const saihUrl = 'https://saih.chminosil.es/index.php?url=/datos/ficha/estacion:N010/area:HID'; 

    const jar = new CookieJar();
    // Ya no usamos httpsAgent aquí porque choca con el wrapper de cookies
    const clienteWeb = wrapper(axios.create({
      jar,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }));

    const response = await clienteWeb.get(saihUrl);
    const html = response.data;
    const $ = cheerio.load(html);

    const celdaDescripcion = $('td:contains("Nivel río Miño en Ourense")').first();
    const nivelTexto = celdaDescripcion.next().next().next().text(); 
    
    console.log(`Texto extraído de la web: "${nivelTexto}"`);
    
    const nivelExtraido = parseFloat(nivelTexto.trim().replace(',', '.'));

    if (isNaN(nivelExtraido)) {
      throw new Error(`No se pudo extraer un número válido. El texto leído fue: "${nivelTexto}"`);
    }

    console.log(`✅ Nivel procesado correctamente: ${nivelExtraido} m`);

    await db.ref('rio/nivel').set(nivelExtraido);
    console.log("🚀 ¡Dato enviado a la base de datos con éxito!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error detallado:", error.message);
    process.exit(1);
  }
}

actualizarNivelRio();
