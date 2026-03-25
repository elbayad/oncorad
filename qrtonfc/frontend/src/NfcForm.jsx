import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Html5Qrcode } from 'html5-qrcode';

const socket = io('http://localhost:4000');

export default function NfcForm() {
  const [tagData, setTagData] = useState(null);
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [readers, setReaders] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const [writeMac, setWriteMac] = useState('FB:26:84:39:EB:45');
  const [writeStatus, setWriteStatus] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsScanning(false);
      }).catch(err => {
        console.error("Failed to stop scanner", err);
        setIsScanning(false);
      });
    } else {
      setIsScanning(false);
    }
  };

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;
      
      const cameraConfig = { facingMode: "environment" };
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      html5QrCode.start(cameraConfig, config, (decodedText) => {
        console.log(`Code matched = ${decodedText}`);
        setWriteMac(decodedText);
        stopScanner();
      }, undefined).catch(err => {
        console.error(`Error starting scanner: `, err);
        alert("Erreur démarrage scanner: " + err);
        stopScanner();
      });
    }, 200);
  };

  useEffect(() => {
    // Gestion de la connexion du Socket (Serveur)
    socket.on('connect', () => setIsServerConnected(true));
    socket.on('disconnect', () => {
      setIsServerConnected(false);
      setReaders([]); // Si on perd le serveur, on perd la liste des lecteurs
    });

    // Statut physique des lecteurs
    socket.on('reader-status', (activeReaders) => {
      setReaders(activeReaders);
    });

    // Écoute des tags NFC
    socket.on('tag-read', (data) => {
      console.log('Nouvelles infos tag NFC reçues :', data);
      setTagData(data);
      setErrorMsg(''); // On efface l'erreur si une lecture réussit
    });

    // Écoute des erreurs de lecture NFC
    socket.on('tag-error', (err) => {
      console.error('Erreur NFC reçue du serveur :', err);
      setErrorMsg(err);
      
      setTimeout(() => setErrorMsg(''), 8000);
    });

    socket.on('write-success', (msg) => {
      setWriteStatus(`✅ ${msg}`);
      setIsWriting(false);
    });

    socket.on('write-error', (err) => {
      setWriteStatus(`❌ ${err}`);
      setIsWriting(false);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reader-status');
      socket.off('tag-read');
      socket.off('tag-error');
      socket.off('write-success');
      socket.off('write-error');
    };
  }, []);

  const handleWrite = () => {
    setIsWriting(true);
    setWriteStatus('⏳ En attente du badge sur le lecteur...');
    socket.emit('write-tag-request', { type: 'bluetooth', mac: writeMac });
  };

  return (
    <div style={styles.container}>
      <h2>Scanner un Tag NFC</h2>
      
      <div style={styles.status}>
        Statut du serveur :{' '}
        <span style={{ color: isServerConnected ? 'green' : 'red', fontWeight: 'bold' }}>
          {isServerConnected ? '🟢 Connecté' : '🔴 Déconnecté'}
        </span>
        <br />
        Lecteur(s) détecté(s) :{' '}
        <span style={{ color: readers.length > 0 ? 'green' : 'red', fontWeight: 'bold' }}>
          {readers.length > 0 ? `🟢 ${readers.join(', ')}` : '🔴 Aucun lecteur USB détecté'}
        </span>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>
          Informations du Badge :
        </label>
        {tagData ? (
          <div style={styles.tagInfoCard}>
            <p style={styles.infoLine}><strong>UID :</strong> {tagData.uid}</p>
            <p style={styles.infoLine}><strong>ATR :</strong> {tagData.atr || 'N/A'}</p>
            <p style={styles.infoLine}><strong>Standard :</strong> {tagData.standard || 'N/A'}</p>
            {tagData.record1 && (
                <p style={styles.infoLine}><strong>Record 1 :</strong> {tagData.record1}</p>
            )}
          </div>
        ) : (
          <input
            id="nfc-input"
            type="text"
            value=""
            readOnly
            placeholder="En attente de lecture..."
            style={styles.input}
          />
        )}
        {errorMsg && (
          <div style={{ color: '#d32f2f', marginTop: '1rem', padding: '0.75rem', border: '1px solid #ef5350', borderRadius: '6px', backgroundColor: '#ffebee', fontSize: '0.9rem', lineHeight: '1.4' }}>
            ⚠️ <strong>Erreur de lecture</strong> : <br /> {errorMsg}
          </div>
        )}
        <p style={styles.helpText}>
          Passez un badge sur le lecteur USB pour remplir automatiquement ces informations.
        </p>
      </div>

      <div style={styles.formGroup}>
         <hr style={{ margin: '1.5rem 0', borderColor: '#eee' }} />
         <h3 style={{ marginTop: 0, fontSize: '1.2rem', color: '#333' }}>Écrire un Record Bluetooth</h3>
         <label style={styles.label}>Adresse MAC :</label>
         <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
           <input
              type="text"
              value={writeMac}
              onChange={(e) => setWriteMac(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
           />
           <button onClick={startScanner} style={styles.scanButton} title="Scanner un QR Code">
             📷
           </button>
         </div>
         <button onClick={handleWrite} disabled={isWriting} style={isWriting ? {...styles.button, opacity: 0.6} : styles.button}>
            {isWriting ? 'Attente du Tag...' : 'Créer et Écrire'}
         </button>
         {writeStatus && <div style={{marginTop: '1rem', fontWeight: 'bold'}}>{writeStatus}</div>}
      </div>

      {isScanning && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Scanner un QR Code</h3>
              <button onClick={stopScanner} style={styles.closeBtn}>✖</button>
            </div>
            <div id="qr-reader" style={{ width: '100%', minHeight: '300px', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    border: '1px solid #ccc',
    borderRadius: '8px',
    maxWidth: '400px',
    margin: '2rem auto',
    backgroundColor: '#fff',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  status: {
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
    color: '#555',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: '0.5rem',
    fontWeight: 'bold',
  },
  input: {
    padding: '0.75rem',
    fontSize: '1rem',
    borderRadius: '4px',
    border: '2px solid #007bff',
    outline: 'none',
    backgroundColor: '#f8f9fa',
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: '2px',
  },
  helpText: {
    fontSize: '0.8rem',
    color: '#666',
    marginTop: '0.5rem',
  },
  tagInfoCard: {
    padding: '1rem',
    borderRadius: '8px',
    backgroundColor: '#e3f2fd',
    border: '1px solid #90caf9',
    textAlign: 'left',
  },
  infoLine: {
    margin: '0.25rem 0',
    fontSize: '0.95rem',
    color: '#0d47a1',
    wordBreak: 'break-all',
  },
  button: {
    padding: '0.75rem',
    marginTop: '1rem',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  scanButton: {
    padding: '0 1rem',
    backgroundColor: '#f8f9fa',
    border: '2px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1.2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: '1.5rem',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '400px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    color: '#333',
  }
};
