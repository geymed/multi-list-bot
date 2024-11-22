import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

async function connectBot() {
    const allowSelfMessages = process.env.ALLOW_SELF_MESSAGES === 'true';

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Disable built-in QR print
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { qr, connection, lastDisconnect } = update;
        if (qr) {
            qrcode.generate(qr, { small: true }); // Display QR code
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== 401;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) connectBot();
        } else if (connection === 'open') {
            console.log('Connected to WhatsApp!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.message || (message.key.fromMe && !allowSelfMessages)) return;

        const sender = message.key.remoteJid!;
        const text = message.message.conversation || '';

        console.log(`Received message from ${sender}: ${text}`);

        if (text === '/ping') {
            await sock.sendMessage(sender, { text: 'Pong!' });
        }
    });
}

connectBot().catch((err) => {
    console.error('Failed to start bot:', err);
});
