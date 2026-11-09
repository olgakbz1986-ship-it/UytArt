/* ПАТЧ: сессия продавца переживает перезагрузки (dev по HTTP) + анкета
   магазина зеркалируется на сервер (PATCH /api/seller/profile). */
const fs = require("fs");
const fails = [];
const rx = (t) => new RegExp(t.replace(/[.*+?^${}()|[\]]/g, "\\$&").replace(/\s+/g, "\\s+"));
function patch(file, find, repl, label) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); }
  catch (e) { fails.push(label + " (файл не найден)"); return; }
  const re = rx(find);
  if (rx(repl).test(src)) { console.log("SKIP:", label); return; }
  if (!re.test(src)) { fails.push(label); return; }
  fs.writeFileSync(file, src.replace(re, repl));
  console.log("OK  :", label);
}
function patchRe(file, re, repl, label) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); }
  catch (e) { fails.push(label + " (файл не найден)"); return; }
  const n = (src.match(re) || []).length;
  if (!n) { fails.push(label); return; }
  fs.writeFileSync(file, src.replace(re, repl));
  console.log("OK  :", label + " (замен: " + n + ")");
}
/* 1. Secure-куки только в production — иначе по HTTP в dev браузер их не хранит */
patchRe("server/index.cjs", /secure:\s*true/g, 'secure: process.env.NODE_ENV === "production"', "index.cjs: secure-флаг куки только в prod");
patchRe("server/admin.cjs", /secure:\s*true/g, 'secure: process.env.NODE_ENV === "production"', "admin.cjs: secure-флаг куки только в prod");
/* 2. Таймер дебаунса для зеркалирования профиля */
patch("src/lib/seller.ts",
`const slugify = (s: string) =>`,
`let profileSyncTimer: any = null;
const slugify = (s: string) =>`,
"seller.ts: таймер синхронизации профиля");
/* 3. saveProfile: зеркалим анкету на сервер (debounce 1c) */
patch("src/lib/seller.ts",
`set((st) => ({ profilesByAccount: { ...st.profilesByAccount, [uid]: prof } }));
      },
      clearActive: () => set({ ...EMPTY_REG }),`,
`set((st) => ({ profilesByAccount: { ...st.profilesByAccount, [uid]: prof } }));
        /* ЗЕРКАЛО НА СЕРВЕР: анкета магазина сохраняется в seller_profile
           (PATCH /api/seller/profile), чтобы кабинет и данные вспоминались
           между сессиями, браузерами и устройствами. Дебаунс 1 секунда. */
        if (useAppStore.getState().session?.role === "seller") {
          if (profileSyncTimer) clearTimeout(profileSyncTimer);
          profileSyncTimer = setTimeout(() => {
            const { accountId: _aid, ...body } = prof;
            api.sellerProfilePatch(body).catch(() => { /* сервер недоступен — синхронизируем в следующий раз */ });
          }, 1000);
        }
      },
      clearActive: () => set({ ...EMPTY_REG }),`,
"seller.ts: saveProfile зеркалирует профиль на сервер");
/* 4. initSellerFromServer: после восстановления сразу отдаём профиль серверу */
patch("src/lib/seller.ts",
`useSellerReg.getState().loadProfile(uid);
  } catch { /* noop */ }`,
`useSellerReg.getState().loadProfile(uid);
    const { accountId: _aid2, ...syncBody } = prof;
    api.sellerProfilePatch(syncBody).catch(() => { /* noop */ });
  } catch { /* noop */ }`,
"seller.ts: initSellerFromServer синхронизирует профиль на сервер");
if (fails.length) {
  console.log("\nНЕ НАЙДЕНО:");
  fails.forEach((f) => console.log("  -", f));
  process.exit(2);
}
console.log("\nПатч сессий и синхронизации применён успешно.");