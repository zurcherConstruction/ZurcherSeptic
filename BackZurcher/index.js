process.env.TZ = process.env.TZ || 'America/New_York';

const { app, server } = require("./src/app.js"); // Importar tanto app como server
const { conn } = require("./src/data");
const { PORT, DB_DEPLOY } = require("./src/config/envs.js");
const { startSignatureCheckCron } = require("./src/services/checkPendingSignatures.js");
const { startFixedExpensesCron } = require("./src/services/autoGenerateFixedExpenses.js");
const { startBudgetRemindersCron } = require("./src/services/checkBudgetReminders.js");
const { startLeadRemindersCron } = require("./src/services/checkLeadReminders.js");
const { startNewsletterSchedulerCron } = require("./src/services/newsletterSchedulerCron.js");
const { startFleetExpiryRemindersCron } = require("./src/services/checkFleetExpiryReminders.js");
const { startGoogleReviewRemindersCron } = require("./src/services/checkGoogleReviewReminders.js");

require("dotenv").config();

// 🚀 Sync solo en entornos remotos y cuando está habilitado explícitamente.
// En local se evita sync para no romper esquemas existentes con alter/constraints.
const hasDeployDb = typeof DB_DEPLOY === 'string' && DB_DEPLOY.trim().startsWith('postgresql://');
const shouldSync = process.env.ENABLE_DB_SYNC === 'true' && hasDeployDb;

// 🔄 Función de reconexión automática
const reconnectDatabase = async (retries = 5, delay = 5000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`🔄 Intento de reconexión ${i}/${retries}...`);
      await conn.authenticate();
      console.log('✅ Reconexión exitosa');
      return true;
    } catch (error) {
      console.log(`❌ Fallo intento ${i}/${retries}: ${error.message}`);
      if (i < retries) {
        console.log(`⏳ Esperando ${delay/1000}s antes del próximo intento...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('❌ No se pudo reconectar a la base de datos después de varios intentos');
  return false;
};

if (shouldSync) {
  console.log('⚠️ DB_SYNC activado - El servidor tardará más en iniciar');
  const syncOptions = process.env.DB_SYNC_ALTER === 'true' ? { alter: true } : { force: false };
  
  conn.sync(syncOptions).then(async () => {
    startServer();
  }).catch((error) => {
    console.error('❌ Error al sincronizar la base de datos:', error);
    process.exit(1);
  });
} else {
  if (process.env.ENABLE_DB_SYNC === 'true' && !DB_DEPLOY) {
    console.log('ℹ️ Sync deshabilitado en local para evitar conflictos de esquema; se validará solo la conexión');
  }

  // 🚀 Inicio rápido: Solo verificar conexión sin sync (con reintentos automáticos)
  conn.authenticate()
    .then(() => {
      console.log('✅ Conexión a base de datos verificada');
      startServer();
    })
    .catch(async (error) => {
      console.error('❌ Error al conectar con la base de datos:', error);
      console.log('🔄 Intentando reconectar...');
      const reconnected = await reconnectDatabase(3, 5000); // 3 intentos, 5s de espera
      if (reconnected) {
        startServer();
      } else {
        console.error('💥 No se pudo establecer conexión con la base de datos');
        process.exit(1);
      }
    });
}

let isServerStarting = false;

function startServer() {
  if (isServerStarting || server.listening) {
    return;
  }

  isServerStarting = true;

  server.once('error', (error) => {
    isServerStarting = false;
    if (error?.code === 'EADDRINUSE') {
      console.error(`❌ Puerto ${PORT} en uso. Esto suele indicar otra instancia local del backend activa.`);
      console.error('💡 Cierra procesos node/nodemon duplicados y reinicia una sola instancia de npm run dev.');
      process.exit(1);
    }

    console.error('❌ Error iniciando servidor HTTP:', error);
    process.exit(1);
  });

  server.listen(PORT, () => {
    isServerStarting = false;
    console.log(`🚀 Servidor escuchando en el puerto: ${PORT} 🚀`);
    startSignatureCheckCron(); // Iniciar el cron para verificar firmas pendientes
    startFixedExpensesCron(); // Iniciar el cron para auto-generar gastos fijos vencidos
    startBudgetRemindersCron(); // Iniciar el cron para recordatorios de budget
    startLeadRemindersCron(); // Iniciar el cron para recordatorios de leads
    startNewsletterSchedulerCron(); // Iniciar el cron para newsletters programados y recurrentes
    startFleetExpiryRemindersCron(); // Iniciar el cron para alertas de vencimiento de flota
    startGoogleReviewRemindersCron(); // Iniciar el cron para recordatorios de Google Review
  });
}

// 🛑 Manejo graceful de señales de terminación
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️ Señal ${signal} recibida, cerrando servidor...`);
  
  // Forzar cierre después de 5 segundos (antes del timeout del hosting)
  const forceExitTimeout = setTimeout(() => {
    console.error('⏱️ Forzando cierre por timeout (5s)');
    process.exit(0); // Exit 0 para evitar errores en npm
  }, 5000);

  // Intentar cerrar ordenadamente
  server.close(() => {
    console.log('✅ Servidor HTTP cerrado');
    clearTimeout(forceExitTimeout);
    
    // No esperar a cerrar BD, solo desconectar
    conn.close()
      .then(() => console.log('✅ BD cerrada'))
      .catch(() => console.log('⚠️ BD forzada'))
      .finally(() => process.exit(0));
  });

  // Si no hay conexiones activas, cerrar inmediatamente
  setTimeout(() => {
    console.log('⏱️ Timeout alcanzado, cerrando...');
    clearTimeout(forceExitTimeout);
    process.exit(0);
  }, 2000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Nodemon usa SIGUSR2 para reiniciar. Hacemos cierre limpio para evitar carreras del puerto.
process.once('SIGUSR2', () => {
  gracefulShutdown('SIGUSR2');
});
