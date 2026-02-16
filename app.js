// OZN PAY - Platform Engine v4.1 (Stability & Performance)
// SAFE MIGRATION: Auto-clear of old data to prevent crashes
if (localStorage.getItem('ozn_v') !== '4.1') {
    localStorage.clear();
    localStorage.setItem('ozn_v', '4.1');
}

const State = {
    user: JSON.parse(localStorage.getItem('ozn_user')) || null,
    products: JSON.parse(localStorage.getItem('ozn_products')) || [
        { id: 'OZN-9XJ2', name: 'Licença Enterprise', value: 1499.90 },
        { id: 'OZN-4K82', name: 'Dashboard Pro', value: 497.00 }
    ],
    notifications: JSON.parse(localStorage.getItem('ozn_notifications')) || [
        { id: 1, type: 'sale', title: 'Venda Aprovada!', value: 497.00, fee: 32.26, net: 464.74, timestamp: new Date().toISOString(), read: true },
        { id: 2, type: 'pix', title: 'Pix Gerado!', value: 1499.90, fee: 92.33, net: 1407.57, timestamp: new Date(Date.now() - 3600000).toISOString(), read: false }
    ],
    currentView: 'dashboard',
    isLocked: false,

    save() {
        localStorage.setItem('ozn_products', JSON.stringify(this.products));
        localStorage.setItem('ozn_notifications', JSON.stringify(this.notifications));
        localStorage.setItem('ozn_user', JSON.stringify(this.user));
    },

    addProduct(name, value) {
        const id = 'OZN-' + Math.random().toString(36).substr(2, 4).toUpperCase();
        this.products.unshift({ id, name, value: parseFloat(value) });
        this.save();
    },

    notify(type, value) {
        const gross = parseFloat(value);
        const fee = (gross * 0.0599) + 2.49;
        const netValue = gross - fee;

        const notif = {
            id: Date.now(),
            type,
            title: type === 'pix' ? 'Pix Gerado!' : 'Venda Aprovada!',
            value: gross,
            fee: fee,
            net: netValue > 0 ? netValue : 0,
            timestamp: new Date().toISOString(),
            read: false
        };
        this.notifications.unshift(notif);
        this.save();
        System.trigger(notif);
    }
};

const System = {
    // Vibrant & Responsive Sound (High-pitched Crystal Ping)
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
        try { if ('vibrate' in navigator) navigator.vibrate([100, 30, 100]); } catch (e) { }
    },

    showBanner(notif) {
        const overlay = document.getElementById('notification-overlay');
        const b = document.createElement('div');
        b.className = 'push-banner animate-enter';
        const icon = notif.type === 'pix' ? 'qr-code' : 'zap';

        b.innerHTML = `
            <div class="push-icon"><i data-lucide="${icon}"></i></div>
            <div class="push-content">
                <h5>OZN PAY</h5>
                <p><b>${notif.title}</b><br>Líquido: R$ ${Number(notif.net || 0).toFixed(2)}</p>
            </div>
        `;
        overlay.prepend(b);
        if (window.lucide) lucide.createIcons({ scope: b });

        setTimeout(() => {
            b.style.opacity = '0';
            b.style.transform = 'translateY(-20px)';
            setTimeout(() => b.remove(), 600);
        }, 5000);
        b.onclick = () => { UI.navigate('notifications'); b.remove(); };
    },

    sendPush(notif) {
        if (!("Notification" in window)) {
            console.warn("Este navegador não suporta notificações de sistema.");
            return;
        }

        if (Notification.permission === "granted") {
            try {
                new Notification("OZN PAY", {
                    body: `${notif.title}\nValor Líquido: R$ ${Number(notif.net || 0).toFixed(2)}`,
                    icon: 'logo.png'
                });
            } catch (e) {
                console.error("Erro ao enviar notificação nativa:", e);
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
                new Notification("OZN PAY", {
                    body: "As notificações de sistema estão configuradas corretamente.",
                    icon: 'logo.png'
                });
            } else if (permission === "denied") {
                alert("As notificações foram bloqueadas. Você precisa permitir nas configurações do navegador.");
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
        el.style.animation = 'none';
        el.style.transform = 'none';
        el.style.position = 'fixed';
        el.style.top = '20px';
        el.style.zIndex = '10001';
        el.style.width = 'calc(100% - 40px)';
        el.style.maxWidth = '400px';

        el.innerHTML = `<div class="push-content"><p style="text-align:center"><b>Status do Sistema</b><br>${msg}</p></div>`;
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

        app.innerHTML = `
            ${this.views[State.currentView]()}
            ${this.components.nav()}
        `;
        if (window.lucide) lucide.createIcons();
    },

    renderLock() {
        const lock = document.getElementById('lock-screen');
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

        const unread = State.notifications.filter(n => !n.read);
        const list = unread.map(n => `
            <div class="push-banner" style="transform:none; animation:none; margin-bottom:10px; pointer-events:none">
                <div class="push-icon"><i data-lucide="${n.type === 'pix' ? 'qr-code' : 'zap'}"></i></div>
                <div class="push-content">
                    <h5>OZN PAY</h5>
                    <p><b>${n.title}</b><br>Líquido: R$ ${Number(n.net || 0).toFixed(2)}</p>
                </div>
            </div>
        `).join('');

        lock.innerHTML = `
            <div class="status-bar">
                <span>OZN 5G</span>
                <div style="display:flex; gap:6px">
                    <i data-lucide="wifi"></i>
                    <i data-lucide="battery"></i>
                </div>
            </div>
            <div class="lock-time" style="margin-top:20px">${time}</div>
            <div class="lock-date">${date}</div>
            <div style="width:100%; padding:20px; overflow-y:auto; flex:1">
                ${list || '<p style="text-align:center; opacity:0.2; margin-top:40px">Aguardando vendas...</p>'}
            </div>
            <div class="unlock-handle" onclick="UI.unlock()"></div>
        `;
        if (window.lucide) lucide.createIcons({ scope: lock });
    },

    unlock() { State.isLocked = false; this.render(); },
    lock() { State.isLocked = true; this.render(); },
    navigate(v) { State.currentView = v; this.render(); window.scrollTo(0, 0); },

    components: {
        nav() {
            const count = State.notifications.filter(n => !n.read).length;
            const badge = count > 0 ? `<div class="badge-luxe">${count}</div>` : '';
            return `
                <nav class="bottom-nav">
                    <a href="javascript:UI.navigate('dashboard')" class="nav-link ${State.currentView === 'dashboard' ? 'active' : ''}">
                        <i data-lucide="layout-grid"></i><span>Painel</span>
                    </a>
                    <a href="javascript:UI.navigate('products')" class="nav-link ${State.currentView === 'products' ? 'active' : ''}">
                        <i data-lucide="package"></i><span>Estoque</span>
                    </a>
                    <a href="javascript:UI.navigate('notifications')" class="nav-link ${State.currentView === 'notifications' ? 'active' : ''}">
                        <div style="position:relative"><i data-lucide="bell"></i>${badge}</div><span>Alertas</span>
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
                        <div class="input-luxe-group">
                            <label>Identificador</label>
                            <input type="text" id="email" class="input-luxe" value="admin@ozn.app">
                        </div>
                        <div class="input-luxe-group">
                            <label>Senha</label>
                            <input type="password" id="pass" class="input-luxe" value="12345">
                        </div>
                        <button class="btn-luxe btn-primary" onclick="Auth.login()">Entrar</button>
                    </div>
                </div>
            `;
        },
        dashboard() {
            const net = State.notifications.reduce((a, b) => a + (Number(b.net) || 0), 0);
            const items = State.notifications.slice(0, 3).map(n => `
                <div class="ntf-card animate-enter">
                    <div class="ntf-icon-box" style="background:rgba(255,255,255,0.05); color:var(${n.type === 'pix' ? '--success' : '--primary'})">
                        <i data-lucide="${n.type === 'pix' ? 'qr-code' : 'zap'}"></i>
                    </div>
                    <div style="flex:1">
                        <div style="display:flex; justify-content:space-between">
                            <h4 class="outfit">${n.title}</h4>
                            <span style="font-weight:900">R$ ${Number(n.value).toFixed(2)}</span>
                        </div>
                        <p style="font-size:0.75rem; color:var(--text-dim)">Taxa: -R$ ${Number(n.fee).toFixed(2)}</p>
                        <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between">
                            <span style="font-size:0.75rem; opacity:0.5">Líquido</span>
                            <span style="color:var(--success); font-weight:800">R$ ${Number(n.net || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `).join('');

            return `
                <div class="animate-enter" style="padding-top:60px">
                    <div style="display:flex; justify-content:space-between; margin-bottom:40px">
                        <h2 class="outfit" style="font-size:1.8rem">Painel Geral</h2>
                        <div onclick="System.askPermission()" style="cursor:pointer; color:var(--primary)"><i data-lucide="bell-ring"></i></div>
                    </div>

                    <div class="card-luxe" style="margin-bottom:30px; background:linear-gradient(135deg, rgba(0,122,255,0.1), transparent)">
                        <p style="font-size:0.8rem; opacity:0.6; margin-bottom:4px">Saldo Líquido</p>
                        <h3 class="outfit" style="font-size:2.2rem">R$ ${net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    </div>

                    <div class="card-luxe" style="margin-bottom:40px">
                        <h4 class="outfit" style="margin-bottom:20px">Gerar Alerta</h4>
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

                    <h3 class="outfit" style="margin-bottom:20px">Recentes</h3>
                    ${items || '<p style="text-align:center; opacity:0.3">Nenhuma venda.</p>'}
                </div>
            `;
        },
        products() {
            return `
                <div class="animate-enter" style="padding-top:60px">
                    <h2 class="outfit" style="font-size:1.8rem; margin-bottom:40px">Produtos</h2>
                    <div class="card-luxe" style="border-style:dashed; background:transparent; margin-bottom:20px">
                        <input type="text" id="pn" class="input-luxe" placeholder="Nome" style="margin-bottom:10px">
                        <input type="number" id="pv" class="input-luxe" placeholder="Preço" style="margin-bottom:20px">
                        <button class="btn-luxe btn-primary" onclick="Actions.add()">Criar Produto</button>
                    </div>
                    ${State.products.map(p => `
                        <div class="card-luxe" style="margin-bottom:12px; padding:16px; display:flex; justify-content:space-between; align-items:center">
                            <span>${p.name}</span>
                            <span style="font-weight:900">R$ ${Number(p.value).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        },
        notifications() {
            State.notifications.forEach(n => n.read = true); State.save();
            return `
                <div class="animate-enter" style="padding-top:60px">
                    <h2 class="outfit" style="font-size:1.8rem; margin-bottom:40px">Histórico</h2>
                    ${State.notifications.map(n => `
                        <div class="ntf-card">
                            <div style="flex:1">
                                <div style="display:flex; justify-content:space-between">
                                    <h4 class="outfit">${n.title}</h4>
                                    <span style="font-weight:800">R$ ${Number(n.value).toFixed(2)}</span>
                                </div>
                                <p style="font-size:0.7rem; opacity:0.5; margin-top:4px">Saldo Líquido: R$ ${Number(n.net || 0).toFixed(2)}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        },
        settings() {
            return `
                <div class="animate-enter" style="padding-top:60px">
                    <h2 class="outfit" style="font-size:1.8rem; margin-bottom:40px">Segurança</h2>
                    <div class="btn-luxe btn-secondary" onclick="UI.lock()" style="margin-bottom:12px">Bloquear Tela</div>
                    <div class="btn-luxe btn-secondary" onclick="Auth.logout()" style="color:var(--error)">Sair</div>
                    <p style="text-align:center; margin-top:40px; opacity:0.3; font-size:0.7rem">OZN PAY Stable v4.1</p>
                </div>
            `;
        }
    }
};

const Auth = {
    login() {
        const e = document.getElementById('email').value;
        const p = document.getElementById('pass').value;
        if (e === 'admin@ozn.app' && p === '12345') { State.user = { e }; State.save(); UI.render(); }
        else alert('Acesso negado');
    },
    logout() { State.user = null; State.save(); UI.render(); }
};

const Actions = {
    gen(type) {
        const sp = document.getElementById('sel-p').value;
        const vm = document.getElementById('val-m').value;
        const val = sp || vm;
        if (!val) return alert('Insira um valor.');
        State.notify(type, val);
        UI.navigate('dashboard');
    },
    add() {
        const n = document.getElementById('pn').value;
        const v = document.getElementById('pv').value;
        if (!n || !v) return alert('Campos vazios.');
        State.addProduct(n, v);
        UI.navigate('products');
    }
};

window.UI = UI; window.Auth = Auth; window.Actions = Actions; window.System = System;
document.addEventListener('DOMContentLoaded', () => UI.render());
if (window.lucide) lucide.createIcons();
