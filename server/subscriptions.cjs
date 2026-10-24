const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'dev-db.json');

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

const genId = () => 'sub_' + Math.random().toString(36).substr(2, 9);

module.exports = function subscriptionsRouter(app) {
  // 1. Получить все подписки текущего пользователя
  app.get('/api/subscriptions', (req, res) => {
    const userId = req.headers['x-user-id'] || 'demo-user-1'; // Fallback для разработки
    const db = readDb();
    const userSubs = db.subscriptions.filter(s => s.userId === userId);
    res.json({ ok: true, subscriptions: userSubs });
  });

  // 2. Добавить новую подписку
  app.post('/api/subscriptions', (req, res) => {
    const userId = req.headers['x-user-id'] || 'demo-user-1';
    const { targetType, targetId } = req.body;
    
    if (!targetType || !targetId) {
      return res.status(400).json({ ok: false, error: 'targetType и targetId обязательны' });
    }

    const db = readDb();
    
    // Проверка на дубликат
    const exists = db.subscriptions.some(s => s.userId === userId && s.targetType === targetType && s.targetId === targetId);
    if (exists) {
      return res.json({ ok: true, message: 'Уже подписаны' });
    }

    const newSub = {
      id: genId(),
      userId,
      targetType,
      targetId,
      createdAt: new Date().toISOString()
    };

    db.subscriptions.push(newSub);
    writeDb(db);
    res.json({ ok: true, subscription: newSub });
  });

  // 3. Удалить подписку
  app.delete('/api/subscriptions/:targetType/:targetId', (req, res) => {
    const userId = req.headers['x-user-id'] || 'demo-user-1';
    const { targetType, targetId } = req.params;
    
    const db = readDb();
    const initialLength = db.subscriptions.length;
    
    db.subscriptions = db.subscriptions.filter(s => 
      !(s.userId === userId && s.targetType === targetType && s.targetId === targetId)
    );

    if (db.subscriptions.length < initialLength) {
      writeDb(db);
      res.json({ ok: true, message: 'Подписка удалена' });
    } else {
      res.status(404).json({ ok: false, error: 'Подписка не найдена' });
    }
  });
};
