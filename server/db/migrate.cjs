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
        process.exitCode = 1;
        break;
      }
    }
    console.log(ran ? `Готово. Применено миграций: ${ran}.` : "Все миграции уже применены.");
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error("Миграция завершилась с ошибкой:", e.message);
  process.exit(1);
});
