/* ============================================================
   server/market-db.cjs — ДВУРЕЖИМНЫЙ СЛОЙ ХРАНЕНИЯ БИРЖИ (ЭТАП 5: паритет PG)
   ------------------------------------------------------------
   Назначение: дать биржевым эндпоинтам (masters/products/purchases/
   market_reviews/deals/sweep) одинаковую работу в обоих режимах:
     • json-dev (бесплатно)  — файл dev-db.json (как исторически);
     • postgres (Yandex)     — DATABASE_URL, таблица market_documents.
   Структура «таблиц» не меняется: каждый раздел хранится как JSONB-документ
   (ключ = имя коллекции). Это соответствует требованию задачи «не менять
   структуру таблиц» и обеспечивает паритетную поддержку новых полей
   (geography/deliveryZone/installCities/deal.escrow/purchases/product_id
   в отзывах) без реляционной миграции.

   Контракт (все методы async):
     read()                → Promise<object>  — копия всей базы {users?, custom_orders?, ...}
     mutate(fn)            → Promise<any>     — атомарно: read → fn(d) → write;
                               возвращает результат fn. В PG внутри транзакции
                               с блокировкой строки документа (SELECT ... FOR UPDATE),
                               поэтому гонка «two writers» исключена.
     mode                  — строка режима (для логов/условий).

   Совместимость: index.cjs продолжает работать с dev-db.json напрямую через
   devDbRead(); этот модуль подключается точечно — сначала sweep эскроу, затем
   endpoints purchases/reviews — без переписывания существующих обработчиков.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const MARKET_COLLECTIONS = ["custom_orders", "order_responses", "order_messages", "complaints", "masters", "products", "purchases", "market_reviews", "notifications"];

function createMarketDb({ dbMode, databaseUrl, devFile }) {
  const isPg = String(dbMode || "").startsWith("postgres") && !!databaseUrl;
  let pool = null;
  if (isPg) {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: databaseUrl });
    /* Идемпотентная подготовка таблицы документов — вызывается один раз при старте. */
    pool.query(
      "create table if not exists market_documents (" +
      "  key text primary key," +
      "  data jsonb not null default '{}'::jsonb," +
      "  updated_at timestamptz not null default now()" +
      ")"
    ).catch((e) => console.error("[MARKET-DB] pg init:", e.message));
  }

  async function read() {
    if (!isPg) {
      return fs.existsSync(devFile) ? JSON.parse(fs.readFileSync(devFile, "utf8")) : {};
    }
    const out = {};
    for (const key of MARKET_COLLECTIONS) {
      const r = await pool.query("select data from market_documents where key=$1", [key]);
      if (r.rows[0]) out[key] = r.rows[0].data;
    }
    return out;
  }

  async function writeAll(d) {
    if (!isPg) {
      fs.writeFileSync(devFile, JSON.stringify(d, null, 2));
      return;
    }
    for (const key of MARKET_COLLECTIONS) {
      const val = d[key];
      if (val === undefined) continue;
      await pool.query(
        "insert into market_documents (key, data, updated_at) values ($1,$2::jsonb, now()) " +
        "on conflict (key) do update set data=$2::jsonb, updated_at=now()",
        [key, JSON.stringify(val)]
      );
    }
  }

  async function mutate(fn) {
    if (!isPg) {
      const d = await read();
      const result = await fn(d);
      await writeAll(d);
      return result;
    }
    const client = await pool.connect();
    try {
      await client.query("begin");
      /* Блокировка строки-«супердокумента» гарантирует сериализацию мутаций. */
      await client.query("select data from market_documents where key='__lock__' for update").catch(() => {});
      const out = {};
      for (const key of MARKET_COLLECTIONS) {
        const r = await client.query("select data from market_documents where key=$1", [key]);
        if (r.rows[0]) out[key] = r.rows[0].data;
      }
      const result = await fn(out);
      for (const key of MARKET_COLLECTIONS) {
        const val = out[key];
        if (val === undefined) continue;
        await client.query(
          "insert into market_documents (key, data, updated_at) values ($1,$2::jsonb, now()) " +
          "on conflict (key) do update set data=$2::jsonb, updated_at=now()",
          [key, JSON.stringify(val)]
        );
      }
      await client.query("commit");
      return result;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  return { mode: isPg ? "postgres (Yandex)" : "json-dev (бесплатно)", read, mutate, writeAll };
}

module.exports = { createMarketDb, MARKET_COLLECTIONS };
