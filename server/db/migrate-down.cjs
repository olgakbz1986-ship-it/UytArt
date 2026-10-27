#!/usr/bin/env node
/* ============================================================
   ОТКАТ МИГРАЦИЙ (ЗАДАЧА 1, п.14)
   ------------------------------------------------------------
   Откатывает последнюю применённую миграцию (по файлу <version>.down.sql)
   либо все миграции до указанной версии включительно.

   Использование:
     npm run migrate:down                 — откат последней миграции
     npm run migrate:down -- 012          — откат всех миграций с версии >= 012
     npm run migrate:down -- all          — откат всех миграций
   ============================================================ */
const fs = require("fs");
const path = require("path");
const u = require("./migrate-utils.cjs");

/** Префикс-версия файла: "012_revoked_tokens" -> "012" */
function versionPrefix(v) {
  const m = String(v).match(/^(\d+)/);
  return m ? m[1] : v;
}

(async () => {
  const arg = process.argv[2]; // например "012" | "all" | undefined
  const pool = u.createPool();
  const client = await pool.connect();
  try {
    await u.ensureMigrationsTable(client);
    const applied = [...(await u.getAppliedVersions(client))].sort();
    if (!applied.length) {
      console.log("Нет применённых миграций для отката.");
      return;
    }

    let toRollback;
    if (!arg) {
      toRollback = [applied[applied.length - 1]]; // последняя
    } else if (String(arg).toLowerCase() === "all") {
      toRollback = [...applied].reverse(); // все, от новой к старой
    } else {
      const target = versionPrefix(String(arg));
      toRollback = applied.filter((v) => versionPrefix(v) >= target).sort().reverse();
      if (!toRollback.length) {
        console.log(`Нет применённых миграций с версии >= ${target} для отката.`);
        return;
      }
    }

    let done = 0;
    for (const version of toRollback) {
      const downFile = path.join(u.MIGRATIONS_DIR, `${version}.down.sql`);
      if (!fs.existsSync(downFile)) {
        console.error(`✗ нет файла отката для ${version} (${version}.down.sql)`);
        process.exitCode = 1;
        break;
      }
      const statements = u.splitSqlStatements(fs.readFileSync(downFile, "utf8"));
      console.log(`< откатывается: ${version}`);
      try {
        await client.query("BEGIN");
        for (const st of statements) await client.query(st);
        await client.query("DELETE FROM schema_migrations WHERE version = $1", [version]);
        await client.query("COMMIT");
        done++;
        console.log(`✓ откачено: ${version}`);
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`✗ ошибка отката ${version}: ${e.message}`);
        process.exitCode = 1;
        break;
      }
    }
    console.log(`Готово. Откачено миграций: ${done}.`);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error("Откат завершился с ошибкой:", e.message);
  process.exit(1);
});
