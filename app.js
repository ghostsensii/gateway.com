// OZN PAY - Platform Engine v5.1 (Robust Sync)

// Configuração do Backend
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : `http://${window.location.hostname}:3000`;

const WS_URL = BACKEND_URL.replace('http', 'ws');

let ws = null;
let reconnectTimeout = null;

// Conectar ao WebSocket
function connectWebSocket() {
    if (ws) return; // Evitar múltiplas conexões

    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('✅ Conectado ao servidor em tempo real');
        showConnectionStatus('✅ Online', '#4cd964');
        setTimeout(() => document.getElementById('connection-status')?.remove(), 2000);
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.event === 'connected') {
            State.notifications = message.data.notifications;
            State.products = message.data.products;
            UI.render();
        }

        if (message.event === 'new_notification') {
            State.notifications.unshift(message.data);
            System.trigger(message.data);
            UI.render();
        }
    };

    ws.onclose = () => {
        console.log('❌ Desconectado do servidor');
        showConnectionStatus('⚠️ Reconectando...', '#ffcc00');
        ws = null;
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket erro:', error);
        ws = null;
    };
}

function showConnectionStatus(msg, color) {
    let status = document.getElementById('connection-status');
    if (!status) {
        status = document.createElement('div');
        status.id = 'connection-status';
        status.style.cssText = `position:fixed;top:10px;right:10px;background:${color};color:#000;padding:8px 16px;border-radius:20px;z-index:10000;font-weight:bold;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.3)`;
        document.body.appendChild(status);
    }
    status.textContent = msg;
    status.style.background = color;
}

// Tentar conectar
if (location.protocol !== 'file:') {
    connectWebSocket();
} else {
    showConnectionStatus('⚠️ Modo Offline (file://)', '#ff3b30');
}

const State = {
    user: JSON.parse(localStorage.getItem('ozn_user')) || null,
    products: [],
    notifications: [],
    currentView: 'dashboard',
    isLocked: false,

    async notify(type, value) {
        // Tentar enviar para o backend
        try {
            const response = await fetch(`${BACKEND_URL}/api/notifications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, value })
            });
            if (!response.ok) throw new Error('Falha na API');

            // Se tiver sucesso, o WebSocket trará de volta a notificação
            // Não precisamos adicionar manualmente aqui para evitar duplicatas
        } catch (e) {
            console.warn('Backend offline, salvando localmente:', e);
            // Fallback: criar localmente
            const gross = parseFloat(value);
            const fee = (gross * 0.0599) + 2.49;
            const net = gross - fee;
            const notif = {
                id: Date.now(), type, title: 'Venda Aprovada (Offline)', value: gross, fee, net, timestamp: new Date().toISOString(), read: false
            };
            this.notifications.unshift(notif);
            System.trigger(notif);
        }
    },

    async addProduct(name, value) {
        const id = 'OZN-' + Math.random().toString(36).substr(2, 4).toUpperCase();
        try {
            await fetch(`${BACKEND_URL}/api/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, value: parseFloat(value) })
            });
        } catch (e) {
            alert('Erro: Servidor offline. Produto criado apenas localmente.');
        }
        this.products.unshift({ id, name, value: parseFloat(value) });
    }
};

const System = {
    audio: new Audio('https://assets.mixkit.co/active_storage/sfx/3005/3005-preview.mp3'),

    trigger(notif) {
        this.playAlert();
        this.vibrate();
        this.showBanner(notif);
        this.sendPush(notif);
        if (State.isLocked) UI.render();
    },

    playAlert() {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => { });
    },

    vibrate() {
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    },

    showBanner(notif) {
        const overlay = document.getElementById('notification-overlay');
        const b = document.createElement('div');
        b.className = 'push-banner animate-enter';

        b.innerHTML = `
            <div class="push-icon"><i data-lucide="${notif.type === 'pix' ? 'qr-code' : 'zap'}"></i></div>
            <div class="push-content">
                <h5>OZN PAY</h5>
                <p><b>${notif.title}</b><br>Líquido: R$ ${Number(notif.net || 0).toFixed(2)}</p>
            </div>
        `;
        overlay.prepend(b);
        if (window.lucide) lucide.createIcons({ scope: b });
        setTimeout(() => b.remove(), 5000);
    },

    sendPush(notif) {
        // Tentar Service Worker (Melhor para mobile)
        if (window.swRegistration && Notification.permission === "granted") {
            try {
                window.swRegistration.showNotification("OZN PAY 💎", {
                    body: `${notif.title}\nLíquido: R$ ${Number(notif.net || 0).toFixed(2)}`,
                    icon: 'logo.png',
                    badge: 'logo.png',
                    vibrate: [200, 100, 200],
                    tag: 'ozn-sale',
                    requireInteraction: true
                });
                return;
            } catch (e) {
                console.warn('Service Worker notification falhou, tentando fallback...');
            }
        }

        // Tentar API Nativa (Fallback)
        if (Notification.permission === "granted") {
            try {
                new Notification("OZN PAY", {
                    body: `${notif.title}\nValor Líquido: R$ ${Number(notif.net || 0).toFixed(2)}`,
                    icon: 'logo.png'
                });
            } catch (e) {
                console.error("Notificação nativa falhou:", e);
            }
        }
    },

    askPermission() {
        if (!("Notification" in window)) {
            alert("Seu navegador não suporta notificações de sistema.");
            return;
        }

        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                UI.showToast("Notificações Ativadas! 🔔");
                // Forçar registro do SW se ainda não tiver
                if ('serviceWorker' in navigator && !window.swRegistration) {
                    navigator.serviceWorker.register('sw.js').then(reg => window.swRegistration = reg);
                }
                this.sendPush({ title: "Sistema Online", net: 0, type: 'sale' });
            } else {
                alert("Você precisa permitir notificações nas configurações do navegador/Android.");
            }
        });
    }
};

const UI = {
    showToast(msg) {
        const t = document.getElementById('status-toast-layer');
        if (!t) return;
        const el = document.createElement('div');
        el.className = 'push-banner animate-enter';
        el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10001;max-width:400px';
        el.innerHTML = `<div class="push-content"><p style="text-align:center">${msg}</p></div>`;
        t.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    },

    render() {
        const app = document.getElementById('app');
        const lock = document.getElementById('lock-screen');

        if (State.isLocked) {
            app.style.display = 'none';
            lock.style.display = 'flex';
            return this.renderLock();
        }

        app.style.display = 'block';
        lock.style.display = 'none';

        if (!State.user) return app.innerHTML = this.views.login();

        app.innerHTML = `${this.views[State.currentView]()} ${this.components.nav()}`;
        if (window.lucide) lucide.createIcons();
    },

    renderLock() {
        const lock = document.getElementById('lock-screen');
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

        const unread = State.notifications.filter(n => !n.read);
        const list = unread.map(n => `
            <div class="push-banner" style="transform:none; animation:none; margin-bottom:10px">
                <div class="push-icon"><i data-lucide="${n.type === 'pix' ? 'qr-code' : 'zap'}"></i></div>
                <div class="push-content">
                    <h5>OZN PAY</h5>
                    <p><b>${n.title}</b><br>R$ ${Number(n.net || 0).toFixed(2)}</p>
                </div>
            </div>
        `).join('');

        lock.innerHTML = `
            <div class="status-bar"><span>OZN 5G</span><i data-lucide="wifi"></i></div>
            <div class="lock-time" style="font-size:4rem; margin-top:40px">${time}</div>
            <div class="lock-date">${date}</div>
            <div style="width:100%; padding:20px; overflow-y:auto; flex:1">${list || '<p style="text-align:center; opacity:0.2">Aguardando...</p>'}</div>
            <div class="unlock-handle" onclick="UI.unlock()"></div>
        `;
        if (window.lucide) lucide.createIcons({ scope: lock });
    },

    unlock() { State.isLocked = false; this.render(); },
    lock() { State.isLocked = true; this.render(); },
    navigate(v) { State.currentView = v; this.render(); },

    components: {
        nav() {
            return `
                <nav class="bottom-nav">
                    <a href="javascript:UI.navigate('dashboard')" class="nav-link ${State.currentView === 'dashboard' ? 'active' : ''}">
                        <i data-lucide="layout-grid"></i><span>Painel</span>
                    </a>
                    <a href="javascript:UI.navigate('products')" class="nav-link ${State.currentView === 'products' ? 'active' : ''}">
                        <i data-lucide="package"></i><span>Estoque</span>
                    </a>
                    <a href="javascript:UI.navigate('notifications')" class="nav-link ${State.currentView === 'notifications' ? 'active' : ''}">
                        <i data-lucide="bell"></i><span>Alertas</span>
                    </a>
                    <a href="javascript:UI.navigate('settings')" class="nav-link ${State.currentView === 'settings' ? 'active' : ''}">
                        <i data-lucide="user"></i><span>Perfil</span>
                    </a>
                </nav>
            `;
        }
    },

    views: {
        login() {
            return `
                <div class="animate-enter" style="padding-top:100px; text-align:center">
                    <h1 class="outfit" style="font-size:3rem; margin-bottom:40px">OZN<span style="opacity:0.3">PAY</span></h1>
                    <div class="card-luxe" style="text-align:left">
                        <input type="text" id="email" class="input-luxe" value="admin@ozn.app" style="margin-bottom:12px">
                        <input type="password" id="pass" class="input-luxe" value="12345" style="margin-bottom:20px">
                        <button class="btn-luxe btn-primary" onclick="Auth.login()">Entrar</button>
                    </div>
                </div>
            `;
        },
        dashboard() {
            const net = State.notifications.reduce((a, b) => a + (Number(b.net) || 0), 0);
            return `
                <div class="animate-enter" style="padding-top:60px">
                    <div style="display:flex; justify-content:space-between; margin-bottom:40px">
                        <h2 class="outfit">Dashboard</h2>
                        <i data-lucide="bell-ring" onclick="System.askPermission()" style="cursor:pointer; color:var(--primary)"></i>
                    </div>
                    <div class="card-luxe" style="margin-bottom:30px; background:linear-gradient(135deg, rgba(0,122,255,0.1), transparent)">
                        <p style="opacity:0.6; font-size:0.8rem">Saldo Líquido</p>
                        <h3 class="outfit" style="font-size:2.2rem">R$ ${net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    </div>
                    <div class="card-luxe" style="margin-bottom:40px">
                        <h4 class="outfit" style="margin-bottom:20px">Gerar Venda</h4>
                        <select id="sel-p" class="input-luxe" style="margin-bottom:12px">
                            <option value="">Valor Manual</option>
                            ${State.products.map(p => `<option value="${p.value}">${p.name}</option>`).join('')}
                        </select>
                        <input type="number" id="val-m" class="input-luxe" placeholder="R$ 0,00" style="margin-bottom:20px">
                        <div style="display:flex; gap:10px">
                            <button class="btn-luxe btn-secondary" onclick="Actions.gen('pix')">Pix</button>
                            <button class="btn-luxe btn-primary" onclick="Actions.gen('sale')">Venda</button>
                        </div>
                    </div>
                    <h3 class="outfit">Recentes</h3>
                    ${State.notifications.slice(0, 3).map(n => `
                        <div class="ntf-card"><b>${n.title}</b><br>R$ ${Number(n.net).toFixed(2)}</div>
                    `).join('')}
                </div>
            `;
        },
        products() {
            return `
                <div class="animate-enter" style="padding-top:60px">
                    <h2 class="outfit" style="margin-bottom:40px">Produtos</h2>
                    <div class="card-luxe" style="border-style:dashed; background:transparent; margin-bottom:20px">
                        <input type="text" id="pn" class="input-luxe" placeholder="Nome" style="margin-bottom:10px">
                        <input type="number" id="pv" class="input-luxe" placeholder="Preço" style="margin-bottom:20px">
                        <button class="btn-luxe btn-primary" onclick="Actions.add()">Criar</button>
                    </div>
                    ${State.products.map(p => `
                        <div class="card-luxe" style="margin-bottom:12px; padding:16px">
                            <b>${p.name}</b><br>R$ ${Number(p.value).toFixed(2)}
                        </div>
                    `).join('')}
                </div>
            `;
        },
        notifications() {
            return `
                <div class="animate-enter" style="padding-top:60px">
                    <h2 class="outfit" style="margin-bottom:40px">Histórico</h2>
                    ${State.notifications.map(n => `
                        <div class="ntf-card">
                            <b>${n.title}</b><br>
                            <span style="color:var(--success)">R$ ${Number(n.net).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        },
        settings() {
            return `
                <div class="animate-enter" style="padding-top:60px">
                    <h2 class="outfit" style="margin-bottom:40px">Configurações</h2>
                    <button class="btn-luxe btn-secondary" onclick="UI.lock()" style="margin-bottom:12px">Bloquear Tela</button>
                    <button class="btn-luxe btn-secondary" onclick="Auth.logout()" style="color:var(--error)">Sair</button>
                    <p style="text-align:center; margin-top:40px; opacity:0.3; font-size:0.7rem">OZN PAY v5.0 Backend</p>
                </div>
            `;
        }
    }
};

const Auth = {
    async login() {
        const email = document.getElementById('email').value;
        try {
            await fetch(`${BACKEND_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            localStorage.setItem('ozn_user', JSON.stringify({ email }));
            State.user = { email };
            UI.render();
        } catch (e) {
            console.error(e);
            alert('Aviso: Não foi possível conectar ao servidor.\nVocê entrará no modo OFFLINE (sem sincronização).');
            // Login offline
            State.user = { email };
            localStorage.setItem('ozn_user', JSON.stringify({ email }));
            UI.render();
        }
    },
    logout() {
        State.user = null;
        localStorage.removeItem('ozn_user');
        UI.render();
    }
};

const Actions = {
    async gen(type) {
        const sp = document.getElementById('sel-p').value;
        const vm = document.getElementById('val-m').value;
        const val = sp || vm;
        if (!val) return alert('Insira um valor.');
        await State.notify(type, val);
        UI.render();
    },
    async add() {
        const n = document.getElementById('pn').value;
        const v = document.getElementById('pv').value;
        if (!n || !v) return alert('Campos vazios.');
        await State.addProduct(n, v);
        UI.render();
    }
};

// Service Worker
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
        window.swRegistration = reg;
    });
}

window.UI = UI; window.Auth = Auth; window.Actions = Actions; window.System = System;
document.addEventListener('DOMContentLoaded', () => UI.render());
if (window.lucide) lucide.createIcons();
