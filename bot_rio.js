// bot_rio.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 

const cheerio = require('cheerio');
const admin = require('firebase-admin');

async function actualizarNivelRio() {
  try {
    console.log("🌊 Entrando al SAIH con Fetch nativo...");

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

    // Usamos fetch nativo, que maneja las redirecciones de forma mucho más natural
    const response = await fetch(saihUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    let nivelExtraido = null;
    let textoLeido = "";

    $('tr').each((index, element) => {
      const celdas = $(element).find('td');
      if (celdas.length >= 4) {
        const descripcion = $(celdas[0]).text().toLowerCase();
        if (descripcion.includes("nivel") && descripcion.includes("miño") && descripcion.includes("ourense") && !descripcion.includes("mar")) {
          textoLeido = $(celdas[3]).text().trim();
          nivelExtraido = parseFloat(textoLeido.replace(',', '.'));
        }
      }
    });

    if (nivelExtraido === null || isNaN(nivelExtraido)) {
      throw new Error(`No se encontró el dato numérico. Último texto leído: "${textoLeido}"`);
    }

    console.log(`✅ Nivel detectado y convertido: ${nivelExtraido} m`);

    await db.ref('rio/nivel').set(nivelExtraido);
    console.log("🚀 ¡Dato enviado a la base de datos con éxito!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error detallado:", error.message);
    process.exit(1);
  }
}

actualizarNivelRio();
