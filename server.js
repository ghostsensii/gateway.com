const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// API Routes
app.get('/api/notifications', (req, res) => {
    res.json(db.getAllNotifications());
});

app.post('/api/notifications', (req, res) => {
    const { type, value } = req.body;
    const gross = parseFloat(value);
    const fee = (gross * 0.0599) + 2.49;
    const net = gross - fee;
    const title = type === 'pix' ? 'Pix Gerado!' : 'Venda Aprovada!';

    const notification = db.createNotification(type, title, gross, fee, net);

    // Broadcast para todos os clientes WebSocket
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(JSON.stringify({
                event: 'new_notification',
                data: notification
            }));
        }
    });

    res.json(notification);
});

app.get('/api/products', (req, res) => {
    res.json(db.getAllProducts());
});

app.post('/api/products', (req, res) => {
    const { id, name, value } = req.body;
    const product = db.createProduct(id, name, parseFloat(value));
    res.json(product);
});

app.post('/api/login', (req, res) => {
    const { email } = req.body;
    const user = db.createUser(email);
    res.json(user);
});

// HTTP Server
const server = app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║     OZN PAY - Servidor Iniciado       ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log(`🌐 Acesse no computador: http://localhost:${PORT}`);
    console.log('');
    console.log('📱 Acesse no celular:');

    // Mostrar IPs locais
    const os = require('os');
    const interfaces = os.networkInterfaces();
    Object.keys(interfaces).forEach(name => {
        interfaces[name].forEach(iface => {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`   http://${iface.address}:${PORT}`);
            }
        });
    });

    console.log('');
    console.log('✅ Banco de dados SQLite conectado');
    console.log('✅ WebSocket ativo (sincronização em tempo real)');
    console.log('');
    console.log('Pressione Ctrl+C para parar o servidor');
    console.log('════════════════════════════════════════');
});

// WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('✅ Novo dispositivo conectado');

    // Enviar estado inicial
    ws.send(JSON.stringify({
        event: 'connected',
        data: {
            notifications: db.getAllNotifications(),
            products: db.getAllProducts()
        }
    }));

    ws.on('close', () => {
        console.log('❌ Dispositivo desconectado');
    });
});

module.exports = { app, server, wss };
