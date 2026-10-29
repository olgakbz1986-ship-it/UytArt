#!/usr/bin/env node
/* ============================================================
   ПРИМЕНЕНИЕ МИГРАЦИЙ (ЗАДАЧА 1, п.13)
   ------------------------------------------------------------
   Читает DATABASE_URL, подключается к PostgreSQL и выполняет все
   миграции из server/db/migrations в правильном порядке, пропуская
   уже применённые (учёт в таблице schema_migrations).

   Использование:
     DATABASE_URL=postgres://... npm run migrate
   ============================================================ */
const fs = require("fs");
const path = require("path");
const u = require("./migrate-utils.cjs");

(async () => {
  const pool = u.createPool();
  const client = await pool.connect();
  try {
    await u.ensureMigrationsTable(client);
    const applied = await u.getAppliedVersions(client);
    const files = u.listMigrationFiles().filter((f) => !f.endsWith(".down.sql"));

    if (!files.length) {
      console.log("Миграции не найдены в", u.MIGRATIONS_DIR);
      return;
    }

    let ran = 0;
    for (const file of files) {
      const version = path.basename(file, ".sql");
      if (applied.has(version)) {
        console.log(`= пропущено (уже применена): ${version}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(u.MIGRATIONS_DIR, file), "utf8");
      const statements = u.splitSqlStatements(sql);
      console.log(`> применяется: ${version}`);
      try {
        await client.query("BEGIN");
        for (const st of statements) await client.query(st);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
          [version]
        );
        await client.query("COMMIT");
        ran++;
        console.log(`✓ применено: ${version}`);
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`✗ ошибка миграции ${version}: ${e.message}`);
        /* КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ №2: процесс обязан завершиться с кодом 1.
           Раньше здесь был только process.exitCode = 1 — асинхронный IIFE
           «дозаканчивался», docker-compose запускал `node server/index.cjs`
           НЕЗАВИСИМО от результата (`&&` по shell-коду, который не дожил до
           проверки), и сервер стартовал с битой схемой (например, без таблицы
           account_tariffs). process.exit(1) гарантирует обрыв && -цепочки. */
        console.error("Migration failed:", e);
        process.exit(1);
      }
    }
    console.log(ran ? `Готово. Применено миграций: ${ran}.` : "Все миграции уже применены.");

    /* КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ №2 (проверка целостности схемы): после применения
       всех миграций убеждаемся, что ключевые таблицы авторизации/тарифов
       реально существуют. Неполная схема = сервер НЕ должен стартовать. */
    const REQUIRED_TABLES = ["users", "account_tariffs"];
    const check = await client.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = any($1)`,
      [REQUIRED_TABLES]
    );
    const missing = REQUIRED_TABLES.filter((t) => !check.rows.some((r) => r.table_name === t));
    if (missing.length) {
      console.error("Migration failed: неполная схема БД, отсутствуют таблицы:", missing.join(", "));
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  /* КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ №2: любая ошибка (в т.ч. на connect()/ensureMigrationsTable)
     обязана завершить процесс с кодом 1 — иначе compose-команда `migrate && index`
     продолжит запуск сервера с битой схемой. */
  console.error("Migration failed:", e);
  process.exit(1);
});
