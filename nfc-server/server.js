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

console.log('Démarrage du serveur NFC Oncorad (Lecture/Écriture)...');

io.on('connection', (socket) => {
  console.log('Client connecté:', socket.id);
  socket.emit('reader-status', Array.from(activeReaders));

  socket.on('write-tag-request', (data) => {
      console.log('Demande d\'écriture reçue :', data);
      pendingWrite = data;
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
  });
});

nfc.on('reader', reader => {
  console.log(`Lecteur détecté : ${reader.reader.name}`);
  activeReaders.add(reader.reader.name);
  io.emit('reader-status', Array.from(activeReaders));

  reader.on('card', async card => {
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
                  const command = Buffer.concat([Buffer.from([0xFF, 0xD6, 0x00, 4 + i, 0x04]), pageData]);
                  await reader.transmit(command, 40);
              }
              
              console.log("Écriture terminée avec succès.");
              io.emit('write-success', "Écriture du record Bluetooth réussie !");
          } catch(err) {
              console.error("Erreur durant l'écriture :", err.message || err);
              io.emit('write-error', "Erreur lors de l'écriture: " + (err.message || err));
          } finally {
              pendingWrite = null;
          }
          return;
      }

      // ===== MODE LECTURE NORMALE =====
      const uid = card.uid.toString('hex').toUpperCase();
      const atr = card.atr ? card.atr.toString('hex').toUpperCase() : null;
      const standard = card.standard || 'Inconnu';

      let record1 = null;

      try {
        const data = await reader.read(4, 64);
        const mime = "application/vnd.bluetooth.ep.oob";
        const mimeIdx = data.indexOf(mime);

        if (mimeIdx !== -1) {
            const payloadOffset = mimeIdx + mime.length;
            if (payloadOffset + 8 <= data.length) {
                const macBytes = data.slice(payloadOffset + 2, payloadOffset + 8);
                record1 = [macBytes[5], macBytes[4], macBytes[3], macBytes[2], macBytes[1], macBytes[0]]
                            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
                            .join(':');
            } else {
                record1 = "Bluetooth MAC (Données tronquées)";
            }
        } else {
            const ndefAscii = data.toString('ascii').replace(/[^\x20-\x7E]/g, '');
            record1 = ndefAscii.trim() !== '' ? `${ndefAscii.substring(0, 30)}...` : "Pas de NDEF textuel trouvé";
        }
      } catch (err) {
        record1 = "Erreur lecture NDEF";
      }

      io.emit('tag-read', { uid, atr, standard, record1 });
    }
  });

  reader.on('error', err => {
    io.emit('tag-error', err.message || err.toString());
  });

  reader.on('end', () => {
    activeReaders.delete(reader.reader.name);
    io.emit('reader-status', Array.from(activeReaders));
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Serveur NFC prêt sur http://localhost:${PORT}`);
});
