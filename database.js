const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'ozn-pay.db'));

// Criar tabelas
db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        value REAL NOT NULL,
        fee REAL NOT NULL,
        net REAL NOT NULL,
        timestamp TEXT NOT NULL,
        read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        value REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL
    );
`);

// Inserir produtos padrão se não existirem
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (productCount.count === 0) {
    const insertProduct = db.prepare('INSERT INTO products (id, name, value) VALUES (?, ?, ?)');
    insertProduct.run('OZN-9XJ2', 'Licença Enterprise', 1499.90);
    insertProduct.run('OZN-4K82', 'Dashboard Pro', 497.00);
}

module.exports = {
    // Notificações
    getAllNotifications: () => db.prepare('SELECT * FROM notifications ORDER BY timestamp DESC').all(),

    createNotification: (type, title, value, fee, net) => {
        const stmt = db.prepare('INSERT INTO notifications (type, title, value, fee, net, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
        const result = stmt.run(type, title, value, fee, net, new Date().toISOString());
        return db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);
    },

    markAsRead: (id) => {
        db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
    },

    // Produtos
    getAllProducts: () => db.prepare('SELECT * FROM products').all(),

    createProduct: (id, name, value) => {
        db.prepare('INSERT INTO products (id, name, value) VALUES (?, ?, ?)').run(id, name, value);
        return { id, name, value };
    },

    // Usuário
    getUser: (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email),

    createUser: (email) => {
        const stmt = db.prepare('INSERT OR IGNORE INTO users (email) VALUES (?)');
        stmt.run(email);
        return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }
};
