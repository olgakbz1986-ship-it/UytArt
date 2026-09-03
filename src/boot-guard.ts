/* Страховка запуска: если модуль упадёт при загрузке (до рендера React),
   вместо «белого экрана» пользователь увидит диагноз. Подключается первым. */
function showFatal(msg: string) {
  const root = document.getElementById("root");
  if (!root || root.children.length > 0) return;
  root.innerHTML = `
    <div style="max-width:640px;margin:0 auto;padding:96px 20px;text-align:center;font-family:Manrope,system-ui,sans-serif;color:#2c2c2c">
      <p style="font-size:44px;margin:0 0 12px">🛠️</p>
      <h1 style="font-size:24px;margin:0 0 8px">УютАрт не смог запуститься</h1>
      <p style="color:#6b6b66;font-size:14px;margin:0 0 20px">Обновите страницу (Ctrl+R). Если не помогло — сбросьте данные ниже.</p>
      <pre style="text-align:left;background:#fff;border:1px solid #eae4d4;border-radius:12px;padding:16px;font-size:11px;overflow:auto;max-height:200px;color:#e53935;white-space:pre-wrap">${msg}</pre>
      <button onclick="localStorage.clear();location.reload()" style="margin-top:20px;height:44px;padding:0 24px;border:none;border-radius:10px;background:#d98e32;color:#2c2c2c;font-weight:700;cursor:pointer">Сбросить и перезапустить</button>
    </div>`;
}

window.addEventListener("error", (e) => {
  if (!document.getElementById("root")?.children.length) {
    showFatal(`${e.message}\n${e.filename || ""}:${e.lineno || ""}`);
  }
});
window.addEventListener("unhandledrejection", (e) => {
  if (!document.getElementById("root")?.children.length) {
    showFatal(String(e.reason));
  }
});
