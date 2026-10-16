// bot_rio.js
const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');

async function actualizarNivelRio() {
  try {
    console.log("🌊 Iniciando lectura del SAIH...");

    // 1. LECTURA DE SECRETOS DE FIREBASE CON REEMPLAZO DE SALTOS DE LÍNEA SEGURO
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("La variable de entorno FIREBASE_SERVICE_ACCOUNT no está definida.");
    }

    let serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    // Reemplaza saltos de línea si vienen escapados como string
    let serviceAccount = JSON.parse(serviceAccountRaw);
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

    // 2. PETICIÓN A LA WEB CON USER-AGENT DE NAVEGADOR REAL
    const saihUrl = 'https://saih.chminosil.es/index.php?url=/datos/ficha/estacion:N010/area:HID'; 

    const response = await axios.get(saihUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 3. EXTRACCIÓN DEL NIVEL
    const celdaDescripcion = $('td:contains("Nivel río Miño en Ourense")').first();
    const nivelTexto = celdaDescripcion.next().next().next().text(); 
    
    console.log(`Texto extraído de la web: "${nivelTexto}"`);
    
    const nivelExtraido = parseFloat(nivelTexto.trim().replace(',', '.'));

    if (isNaN(nivelExtraido)) {
      throw new Error(`No se pudo extraer un número válido. El texto leído fue: "${nivelTexto}"`);
    }

    console.log(`✅ Nivel procesado correctamente: ${nivelExtraido} m`);

    // 4. GUARDAR EN FIREBASE
    await db.ref('rio/nivel').set(nivelExtraido);
    console.log("🚀 ¡Dato enviado a la base de datos con éxito!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error detallado:", error);
    process.exit(1); // Sale con error 1 para capturar el detalle exacto en GitHub
  }
}

actualizarNivelRio();