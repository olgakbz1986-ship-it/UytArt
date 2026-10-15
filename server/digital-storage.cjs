// Модуль безопасного хранилища цифровых продуктов (ТЗ Раздел 4)
// Приватные файлы: server/uploads/digital (вне public/dist, недоступны по прямой ссылке)
// Публичные превью: public/previews
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIGITAL_UPLOADS_DIR = path.join(__dirname, 'uploads', 'digital');
const PUBLIC_PREVIEWS_DIR = path.join(__dirname, '..', 'public', 'previews');

if (!fs.existsSync(DIGITAL_UPLOADS_DIR)) fs.mkdirSync(DIGITAL_UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_PREVIEWS_DIR)) fs.mkdirSync(PUBLIC_PREVIEWS_DIR, { recursive: true });

function generateUniqueFilename(originalName) {
  const ext = path.extname(originalName);
  const uniqueId = crypto.randomBytes(16).toString('hex');
  return `${Date.now()}-${uniqueId}${ext}`;
}

module.exports = {
  uploadDigitalFile: (fileBuffer, originalName) => {
    const filename = generateUniqueFilename(originalName);
    const filepath = path.join(DIGITAL_UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, fileBuffer);
    return `/uploads/digital/${filename}`;
  },
  uploadPreview: (fileBuffer, originalName) => {
    const filename = generateUniqueFilename(originalName);
    const filepath = path.join(PUBLIC_PREVIEWS_DIR, filename);
    fs.writeFileSync(filepath, fileBuffer);
    return `/previews/${filename}`;
  },
  generatePresignedUrl: (filepath) => {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 минут
    return `${filepath}?token=${token}&expires=${expiresAt}`;
  },
  validatePresignedUrl: (url) => {
    try {
      const urlObj = new URL(url, 'http://localhost');
      const expires = parseInt(urlObj.searchParams.get('expires'));
      return Date.now() <= expires;
    } catch (e) { return false; }
  }
};
