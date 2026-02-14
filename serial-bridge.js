/**
 * SERIAL BRIDGE — Communique entre Arduino (port série) et Backend (HTTP)
 * 
 * Fonctionnement:
 * 1. Écoute le port série pour les messages d'Arduino
 * 2. Récupère les commandes en attente du backend
 * 3. Envoie les commandes à Arduino
 * 4. Reçoit les ACK d'Arduino et les poste au backend
 * 5. Reçoit les UIDs RFID et les poste au backend
 * 
 * Installation: npm install serialport axios
 * 
 * Utilisation:
 *   SERIAL_PORT=COM3 BACKEND_URL=http://localhost:3000/api/hardware node serial-bridge.js
 *   (ou sur Linux: /dev/ttyUSB0)
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const axios = require('axios');

// ============================================
// CONFIGURATION
// ============================================

const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';  // Windows: COM3, macOS/Linux: /dev/ttyUSB0
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api/hardware';
const POLL_INTERVAL_MS = 2000;  // Récupérer commandes toutes les 2 secondes
const BAUD_RATE = 9600;

console.log('═'.repeat(60));
console.log('🔌 SERIAL BRIDGE — Arduino ↔ Backend');
console.log('═'.repeat(60));
console.log(`Port série: ${SERIAL_PORT}`);
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`Intervalle poll: ${POLL_INTERVAL_MS}ms`);
console.log('═'.repeat(60));

// ============================================
// CONNEXION AU PORT SÉRIE
// ============================================

let port;
let parser;
let isConnected = false;

try {
  port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
  parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  port.on('open', () => {
    isConnected = true;
    console.log('✅ Port série ouvert avec succès');
  });

  port.on('error', (err) => {
    console.error(`❌ Erreur port série: ${err.message}`);
    console.log(`   Vérifiez que le port ${SERIAL_PORT} est correct`);
    process.exit(1);
  });
} catch (err) {
  console.error(`❌ Impossible d'ouvrir le port ${SERIAL_PORT}`);
  console.error(`   Erreur: ${err.message}`);
  console.log('\n💡 Solutions:');
  console.log('   1. Vérifiez que l\'Arduino est branché');
  console.log('   2. Vérifiez le port (COM3, COM4, /dev/ttyUSB0, etc.)');
  console.log('   3. Relancez: SERIAL_PORT=COM3 node serial-bridge.js');
  process.exit(1);
}

// ============================================
// ÉCOUTER LES MESSAGES DEPUIS ARDUINO
// ============================================

parser.on('data', async (line) => {
  line = line.trim();

  if (!line) return;

  console.log(`\n📨 Arduino → Bridge: "${line}"`);

  try {
    // ---- CAS 1: ACK depuis Arduino ----
    // Format: ACK:cmd-123:OPENED
    // ou: ACK:cmd-123:CLOSED
    // ou: ACK:cmd-123:FAILED:errormsg
    if (line.startsWith('ACK:')) {
      const parts = line.split(':');
      const cmdId = parts[1];
      const result = parts[2];
      const message = parts[3] || '';

      console.log(`   → ACK pour commande ${cmdId}: ${result}`);

      try {
        const response = await axios.put(
          `${BACKEND_URL}/commands/${cmdId}/ack`,
          { result, message },
          { timeout: 5000 }
        );
        console.log(`   ✅ Backend a enregistré l'ACK`);
      } catch (err) {
        console.error(`   ❌ Erreur envoi ACK au backend: ${err.message}`);
      }
    }

    // ---- CAS 2: UID RFID depuis Arduino ----
    // Format: UID:0A1B2C3D (hexadécimal)
    else if (line.startsWith('UID:') || line.startsWith('UID HEX:')) {
      const uid = line.split(':')[1].trim();
      console.log(`   → UID RFID détecté: ${uid}`);

      try {
        const response = await axios.post(
          `${BACKEND_URL}/rfid`,
          { uid },
          { timeout: 5000 }
        );
        console.log(`   ✅ Backend a enregistré l'UID RFID`);
      } catch (err) {
        console.error(`   ❌ Erreur envoi RFID au backend: ${err.message}`);
      }
    }

    // ---- CAS 3: Messages de log Arduino (affichage seulement) ----
    else {
      console.log(`   📝 Log Arduino: ${line}`);
    }

  } catch (err) {
    console.error(`❌ Erreur traitement ligne Arduino: ${err.message}`);
  }
});

// ============================================
// RÉCUPÉRER LES COMMANDES DEPUIS LE BACKEND ET LES ENVOYER À ARDUINO
// ============================================

async function pollAndSendCommands() {
  if (!isConnected) {
    console.log('⚠️  Port série pas encore connecté, retry...');
    return;
  }

  try {
    // Récupérer les commandes en attente
    const response = await axios.get(
      `${BACKEND_URL}/commands?pending=true`,
      { timeout: 5000 }
    );

    const cmds = response.data.commands || [];

    if (cmds.length === 0) {
      // console.log('⏳ Aucune commande en attente...');
      return;
    }

    for (const cmd of cmds) {
      if (cmd.status === 'PENDING') {
        // Format: OPEN:x:cmd-123 ou CLOSE:x:cmd-123
        const txt = `${cmd.type.toUpperCase()}:${cmd.drawer}:${cmd.id}\n`;

        console.log(`\n📤 Bridge → Arduino: "${txt.trim()}"`);

        try {
          port.write(txt);

          // Marquer comme SENT au backend (optionnel)
          await axios.put(
            `${BACKEND_URL}/commands/${cmd.id}/ack`,
            { result: 'SENT', message: 'commande envoyée au port série' },
            { timeout: 5000 }
          );

          console.log(`   ✅ Commande envoyée et marquée SENT au backend`);
        } catch (err) {
          console.error(`   ❌ Erreur lors de l'envoi: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error(`❌ Erreur polling backend: ${err.message}`);
    console.log(`   Vérifiez que le backend est disponible sur ${BACKEND_URL}`);
  }
}

// Lancer le polling toutes les N millisecondes
setInterval(pollAndSendCommands, POLL_INTERVAL_MS);

console.log(`\n⏰ Démarrage du polling des commandes toutes les ${POLL_INTERVAL_MS}ms...`);
console.log(`\n🎯 Attendez un message "Arduino connecté" ou "Aucune commande en attente"...\n`);

// ============================================
// GESTION DE L'ARRÊT GRACIEUX
// ============================================

process.on('SIGINT', () => {
  console.log('\n\n⏸  Arrêt du bridge...');
  if (port && port.isOpen) {
    port.close(() => {
      console.log('✅ Port série fermé');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
