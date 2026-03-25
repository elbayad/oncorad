const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { NFC } = require('nfc-pcsc');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const nfc = new NFC();

const activeReaders = new Set();
let pendingWrite = null;

console.log('Démarrage du serveur NFC...');

// Lors de la connexion d'un client React
io.on('connection', (socket) => {
  console.log('Client React connecté:', socket.id);
  // Envoyer la liste des lecteurs actuels
  socket.emit('reader-status', Array.from(activeReaders));

  socket.on('write-tag-request', (data) => {
      console.log('Demande d\'écriture reçue :', data);
      pendingWrite = data;
  });

  socket.on('disconnect', () => {
    console.log('Client React déconnecté:', socket.id);
  });
});

// Écoute des événements du lecteur NFC
nfc.on('reader', reader => {
  console.log(`Lecteur détecté : ${reader.reader.name}`);
  activeReaders.add(reader.reader.name);
  io.emit('reader-status', Array.from(activeReaders));
  
  // Faire biper le lecteur lors de la détection (si supporté, ici ACR122U le fait souvent seul)

  reader.on('card', async card => {
    console.log();
    console.log(`Tag détecté par ${reader.reader.name}...`);
    
    // Vérification de sécurité si le tag n'a pas pu être lu entièrement
    if (card && card.uid) {
      // ===== GESTIONNAIRE D'ÉCRITURE PRIORITAIRE =====
      if (pendingWrite && pendingWrite.type === 'bluetooth') {
          try {
              console.log("Écriture NDEF en cours pour MAC :", pendingWrite.mac);
              const macHex = pendingWrite.mac.replace(/:/g, '').toUpperCase();
              if (macHex.length !== 12) throw new Error("Format MAC invalide (12 caractères héxa requis)");
              
              const macBytes = Buffer.from(macHex, 'hex');
              const macBytesRev = Buffer.from([macBytes[5], macBytes[4], macBytes[3], macBytes[2], macBytes[1], macBytes[0]]);
              
              const mimeType = Buffer.from("application/vnd.bluetooth.ep.oob");
              const payload = Buffer.concat([Buffer.from([0x08, 0x00]), macBytesRev]);
              
              const ndefHeader = Buffer.from([0xD2, mimeType.length, payload.length]);
              const ndefMessage = Buffer.concat([ndefHeader, mimeType, payload]);
              
              const ndefTlv = Buffer.concat([ Buffer.from([0x03, ndefMessage.length]), ndefMessage, Buffer.from([0xFE]) ]);
              
              const paddingSize = 4 - (ndefTlv.length % 4);
              const paddedTlv = paddingSize < 4 ? Buffer.concat([ndefTlv, Buffer.alloc(paddingSize, 0)]) : ndefTlv;
              
              const totalPages = paddedTlv.length / 4;
              for (let i = 0; i < totalPages; i++) {
                  const pageData = paddedTlv.slice(i * 4, (i + 1) * 4);
                  // Commande APDU PC/SC pour écrire 4 octets (Mifare Update Binary : FF D6 00 <page> 04 <data>)
                  const command = Buffer.concat([Buffer.from([0xFF, 0xD6, 0x00, 4 + i, 0x04]), pageData]);
                  await reader.transmit(command, 40);
              }
              
              console.log("Écriture terminée avec succès.");
              io.emit('write-success', "Écriture du record Bluetooth réussie !");
          } catch(err) {
              console.error("Erreur durant l'écriture :", err.message || err);
              io.emit('write-error', "Erreur lors de l'écriture: " + (err.message || err));
          } finally {
              pendingWrite = null; // Remise à zéro
          }
          return; // Ne pas poursuivre la lecture normale pour éviter des conflits immédiats
      }

      // ===== MODE LECTURE NORMALE =====
      // Convertir l'UID et l'ATR (Buffer) en chaîne hexadécimale majuscule
      const uid = card.uid.toString('hex').toUpperCase();
      const atr = card.atr ? card.atr.toString('hex').toUpperCase() : null;
      const standard = card.standard || 'Inconnu';

      console.log(`UID du tag : ${uid}`);
      if (atr) console.log(`ATR du tag : ${atr}`);
      console.log(`Standard : ${standard}`);

      let record1 = null;

      try {
        // Lecture asynchrone de 64 octets (16 blocs/pages) à partir du bloc 4 de l'EEPROM
        const data = await reader.read(4, 64);
        console.log("Mémoire lue (blocs 4-19) :", data.toString('hex'));

        // Chercher "application/vnd.bluetooth.ep.oob" ou "application/vnd.bluetooth.le.oob"
        const mime = "application/vnd.bluetooth.ep.oob";
        const mimeIdx = data.indexOf(mime);

        if (mimeIdx !== -1) {
            const payloadOffset = mimeIdx + mime.length;
            // Structure Bluetooth OOB : u16 Length puis u48 MAC Address (Inversée / Little Endian)
            if (payloadOffset + 8 <= data.length) {
                const macBytes = data.slice(payloadOffset + 2, payloadOffset + 8);
                record1 = [macBytes[5], macBytes[4], macBytes[3], macBytes[2], macBytes[1], macBytes[0]]
                            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
                            .join(':');
            } else {
                record1 = "Bluetooth MAC (Données tronquées)";
            }
        } else {
            // Pas de bluetooth OOB : essayer de montrer les strings de base (ex: texte/URLs simples)
            const ndefAscii = data.toString('ascii').replace(/[^\x20-\x7E]/g, '');
            record1 = ndefAscii.trim() !== '' ? `${ndefAscii.substring(0, 30)}...` : "Pas de NDEF textuel trouvé";
        }
      } catch (err) {
        console.error("Erreur de lecture des pages NDEF :", err.message || err);
        record1 = "Erreur lecture NDEF (Non-supporté ?)";
      }

      // Émettre l'événement vers tous les clients React connectés
      io.emit('tag-read', { uid, atr, standard, record1 });
    } else {
      console.log(`Tag détecté mais il n'a pas d'UID lisible ou l'AID est manquant.`);
    }
  });

  reader.on('card.off', card => {
    if (card && card.uid) {
      console.log(`Tag retiré : ${card.uid.toString('hex').toUpperCase()}`);
    } else {
      console.log(`Tag retiré (sans UID).`);
    }
  });

  reader.on('error', err => {
    console.error(`Erreur sur le lecteur ${reader.reader.name} :`, err);
    // Transmettre l'erreur au frontend
    io.emit('tag-error', err.message || err.toString());
  });

  reader.on('end', () => {
    console.log(`Lecteur déconnecté : ${reader.reader.name}`);
    activeReaders.delete(reader.reader.name);
    io.emit('reader-status', Array.from(activeReaders));
  });
});

nfc.on('error', err => {
  console.error('Erreur du service NFC : ', err);
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Serveur prêt. En écoute sur http://localhost:${PORT}`);
  console.log('En attente de connexion du lecteur NFC...');
});
