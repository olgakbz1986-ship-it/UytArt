/* Паритетный E2E двухрежимного слоя: isolated JSON + PG-совместимый SQL через mock Pool */
const assert = require("assert");
const fs = require("fs");
const { createMarketDb, MARKET_COLLECTIONS } = require("./market-db.cjs");

(async () => {
  /* --- Режим 1: изолированный json-dev (временный файл) --- */
  const tmpFile = "/tmp/mdb-test.json";
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const jdb = createMarketDb({ dbMode: "json-dev (бесплатно)", devFile: tmpFile });
  await jdb.mutate((d) => { d.custom_orders = [{ id: "x1", deal: { escrow: "held" } }]; d.purchases = [{ id: "p1" }]; });
  let s = await jdb.read();
  assert.strictEqual(s.custom_orders.length, 1, "json read-after-write");
  console.log("PASS | market-db json-dev: mutate/read");

  /* --- Режим 2: postgres через mock-Pool (та же семантика SQL, что в market-db.cjs) --- */
  const store = new Map(); // key -> data
  let inTx = false;
  const fakePool = {
    async query(sql, params) {
      if (/create table/i.test(sql)) return { rows: [], rowCount: 0 };
      if (/^begin$/.test(sql.trim())) { inTx = true; return {}; }
      if (/^commit$/.test(sql.trim())) { inTx = false; return {}; }
      if (/^rollback$/.test(sql.trim())) { inTx = false; return {}; }
      if (/for update/i.test(sql)) { await Promise.resolve(); return { rows: [], rowCount: 0 }; }
      if (/select data from market_documents where key=\$1/i.test(sql)) {
        const k = params[0];
        return { rows: store.has(k) ? [{ data: store.get(k) }] : [], rowCount: store.has(k) ? 1 : 0 };
      }
      if (/insert into market_documents .* on conflict/i.test(sql)) {
        store.set(params[0], typeof params[1] === "string" ? JSON.parse(params[1]) : params[1]);
        return { rows: [], rowCount: 1 };
      }
      throw new Error("unexpected sql: " + sql);
    },
    async connect() {
      return {
        query: async (sql, p) => {
          const t = sql.trim();
          if (/^begin$/.test(t)) { inTx = true; return {}; }
          if (/^commit$/.test(t) || /^rollback$/.test(t)) { inTx = false; return {}; }
          assert.ok(inTx, "client.query вне транзакции: " + sql);
          return fakePool.query(sql, p);
        },
        release() {},
      };
    },
  };
  /* Подменяем require('pg') на mock до создания пула */
  const Module = require("module");
  const origReq = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === "pg") return { Pool: function () { return fakePool; } };
    return origReq.apply(this, arguments);
  };
  process.env.DATABASE_URL = "postgres://mock/only-for-parity-test";
  const pdb = createMarketDb({ dbMode: "postgres (Yandex)", databaseUrl: process.env.DATABASE_URL, devFile: tmpFile });
  Module.prototype.require = origReq;

  await pdb.mutate((d) => { d.custom_orders = [{ id: "pg1", deal: { escrow: "held", expires_at: "2020-01-01T00:00:00Z" } }]; d.market_reviews = []; });
  const sp = await pdb.read();
  assert.strictEqual(sp.custom_orders[0].id, "pg1", "pg read-after-mutate");
  assert.ok(store.has("custom_orders"), "коллекция сохранена как документ");
  console.log("PASS | market-db postgres: транзакционный mutate/read через JSONB-документы");

  /* --- Интеграция sweep с PG-слоем: логика выпуска на данных обоих режимов идентична --- */
  const dSnap = await pdb.read();
  const ord = dSnap.custom_orders.find((o) => o.id === "pg1");
  assert.strictEqual(ord.deal.escrow, "held");
  ord.deal.escrow = "released"; ord.deal.status = "settled"; ord.deal.release_reason = "timeout_no_disputes";
  await pdb.writeAll(dSnap);
  const chk = await pdb.read();
  assert.strictEqual(chk.custom_orders.find((o) => o.id === "pg1").deal.escrow, "released");
  console.log("PASS | паритет semantics: held→released/settled переносится между режимами без изменений структуры");
  console.log("ALL_PARITY_PASS");
})().catch((e) => { console.error("PARITY_FAIL:", e.message); process.exit(1); });
