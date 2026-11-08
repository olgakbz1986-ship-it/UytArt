/* DEV-креды служебного админ-аккаунта кабинета.
   Единственный источник значений по умолчанию: переопределяются через .env
   (UYART_DEV_ADMIN_EMAIL / UYART_DEV_ADMIN_PASSWORD). Дефолты — только для
   локальной разработки; в production dev-вход отключён (NODE_ENV === "production"). */
const ADMIN_EMAIL = process.env.UYART_DEV_ADMIN_EMAIL || "almin@starttechpro.ru";
const ADMIN_PASSWORD = process.env.UYART_DEV_ADMIN_PASSWORD || "admin123";
module.exports = { ADMIN_EMAIL, ADMIN_PASSWORD };
