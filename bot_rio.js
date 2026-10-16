// bot_rio.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 

const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');

async function actualizarNivelRio() {
  try {
    console.log("🌊 Entrando al SAIH...");

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

    const response = await axios.get(saihUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'PHPSESSID=sesion_falsa_bot_12345; acepta_cookies=1'
      }
    });

    const $ = cheerio.load(response.data);
    
    let nivelExtraido = null;
    let textoLeido = "";

    // Escaneamos todas las filas de la página buscando las palabras clave
    $('tr').each((index, element) => {
      const celdas = $(element).find('td');
      
      if (celdas.length >= 4) {
        const descripcion = $(celdas[0]).text().toLowerCase();
        
        // Buscamos la fila que tenga "nivel", "miño" y "ourense" pero que NO sea la del nivel del mar
        if (descripcion.includes("nivel") && descripcion.includes("miño") && descripcion.includes("ourense") && !descripcion.includes("mar")) {
          textoLeido = $(celdas[3]).text().trim();
          nivelExtraido = parseFloat(textoLeido.replace(',', '.'));
        }
      }
    });

    if (nivelExtraido === null || isNaN(nivelExtraido)) {
      console.log("⚠️ HTML recibido (título):", $('title').text());
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
