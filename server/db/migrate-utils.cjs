/* ============================================================
   УТИЛИТЫ МИГРАЦИЙ (ЗАДАЧА 1, п.13–15)
   ------------------------------------------------------------
   · Читает DATABASE_URL из переменных окружения (.env / .env.server).
   · Подключается к PostgreSQL через pg.Pool.
   · Таблица schema_migrations хранит применённые версии миграций,
     что позволяет применять только новые и откатывать последние.
   ============================================================ */
require("dotenv").config({ path: process.env.DOTENV_PATH || ".env" });
require("dotenv").config({ path: ".env.server", quiet: true });

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

/** Возвращает Pool по DATABASE_URL (или параметрам PG* по умолчанию). */
function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString && !process.env.PGHOST) {
    throw new Error(
      "DATABASE_URL не задан. Укажите строку подключения к PostgreSQL, " +
        "например: postgres://user:password@host:5432/dbname"
    );
  }
  return new Pool(connectionString ? { connectionString } : {});
}

/** Гарантирует существование таблицы учёта миграций. */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}

/** Список всех файлов миграций в правильном (лексикографическом) порядке. */
function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d[\d_-]*.*\.sql$/i.test(f))
    .sort();
}

/** Уже применённые версии. */
async function getAppliedVersions(client) {
  const { rows } = await client.query(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  return new Set(rows.map((r) => r.version));
}

/** Удалить комментарии (строчные и блочные), не затрагивая строковые
 *  литералы. Нужен предварительный проход, чтобы `;` внутри комментариев
 *  не рвали инструкции пополам. */
function stripSqlComments(sql) {
  let out = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  while (i < sql.length) {
    const ch = sql[i];
    if (inSingle) {
      out += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") { out += "'"; i += 2; continue; }
        inSingle = false;
      }
      i++; continue;
    }
    if (inDouble) {
      out += ch;
      if (ch === '"') inDouble = false;
      i++; continue;
    }
    if (ch === "'") { inSingle = true; out += ch; i++; continue; }
    if (ch === '"') { inDouble = true; out += ch; i++; continue; }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue; // перевод строки оставим как разделитель
    }
    if (ch === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      out += " ";
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** Прочитать SQL миграции и разбить на отдельные инструкции.
 *  Разбиение учитывает dollar-quoted блоки ($tag$...$tag$), чтобы `;`
 *  внутри них не ломали запросы. */
function splitSqlStatements(sql) {
  sql = stripSqlComments(sql);
  const out = [];
  let cur = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag = null;

  while (i < sql.length) {
    const ch = sql[i];
    const rest = sql.slice(i);

    if (inLineComment) {
      if (ch === "\n") { inLineComment = false; cur += ch; }
      else cur += ch;
      i++; continue;
    }
    if (inBlockComment) {
      if (ch === "*" && sql[i + 1] === "/") { inBlockComment = false; i += 2; cur += " "; continue; }
      cur += ch; i++; continue;
    }
    if (dollarTag) {
      if (rest.startsWith(dollarTag)) { cur += dollarTag; i += dollarTag.length; dollarTag = null; continue; }
      cur += ch; i++; continue;
    }
    if (inSingle) {
      if (ch === "'") {
        if (sql[i + 1] === "'") { cur += "''"; i += 2; continue; }
        inSingle = false;
      }
      cur += ch; i++; continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      cur += ch; i++; continue;
    }
    if (ch === "-" && sql[i + 1] === "-") { inLineComment = true; i += 2; continue; }
    if (ch === "/" && sql[i + 1] === "*") { inBlockComment = true; i += 2; continue; }
    if (ch === "'") { inSingle = true; cur += ch; i++; continue; }
    if (ch === '"') { inDouble = true; cur += ch; i++; continue; }
    const m = rest.match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
    if (m) { dollarTag = m[0]; cur += m[0]; i += m[0].length; continue; }
    if (ch === ";") {
      const stmt = cur.trim();
      if (stmt) out.push(stmt);
      cur = "";
      i++; continue;
    }
    cur += ch; i++;
  }
  const last = cur.trim();
  if (last) out.push(last);
  return out;
}

module.exports = {
  createPool,
  ensureMigrationsTable,
  listMigrationFiles,
  getAppliedVersions,
  splitSqlStatements,
  MIGRATIONS_DIR,
};
