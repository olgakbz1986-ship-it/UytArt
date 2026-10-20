import { useState } from "react";
import { PasswordInput } from "../components/PasswordInput";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Smartphone, Mail, CheckCircle2, Store } from "lucide-react";
import { useAppStore, type UserRole } from "../lib/store";
import { Btn, Field } from "../components/ui";
import { SellerRegWizard } from "./extras";
import { adminApi } from "../lib/admin-api";

/* ============================================================
   /auth — вход (SMS / email) и регистрация с переключателем
   «Покупатель / Продавец» (самозанятый, ИП, ООО — внутри мастера)

   Кабинет администратора: если в поле «Email или телефон» введён заранее
   разрешённый служебный email, сервер переводит вход в OTP-поток (код на
   почту, 5 минут, одноразовый, при каждом входе). Телефонный вход для
   админских аккаунтов отключён. Публичных упоминаний кабинета нет.
   ============================================================ */
export function AuthPage() {
  const [sp] = useSearchParams();
  /* ПУНКТ 5: после подтверждения email сервер редиректит на /#/auth?email=... —
     подставляем этот email в форму входа, чтобы пользователю не пришлось вводить его заново. */
  const preEmail = sp.get("email") || "";
  const login = useAppStore((s) => s.login);
  const authLogin = useAppStore((s) => s.authLogin);
  const authRegister = useAppStore((s) => s.authRegister);
  const nav = useNavigate();

  const [emailForm, setEmailForm] = useState({ email: preEmail, password: "" });
  const [tab, setTab] = useState<"sms" | "email">(preEmail ? "email" : "sms");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [regOpen, setRegOpen] = useState(sp.get("mode") === "register");
  const [regTab, setRegTab] = useState<"buyer" | "seller">(sp.get("role") === "seller" ? "seller" : "buyer");
  /* ПУНКТ 2/6: регистрация покупателя — один шаг (имя, email, телефон, пароль, согласие).
     Устаревшие шаги выбора категорий/стилей удалены вместе с полем styles. */
  const [reg, setReg] = useState({ name: "", email: "", phone: "", password: "", tos: false });
  const [confirmInfo, setConfirmInfo] = useState<null | { email: string; devUrl?: string }>(null);

  /* ── Кабинет: тихий вход для служебных email (публично не упоминается).
     Поток: страница входа → вкладка «По email» → разрешённый служебный email +
     пароль → сервер распознаёт адрес и выдаёт код (в dev-режиме — фиксированный
     мгновенный код, в проде — одноразовый код на почту) → подтверждение кода. ── */
  const [adminStep, setAdminStep] = useState<"idle" | "code">("idle");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [adminHint, setAdminHint] = useState("");

  const startAdminOtp = async (): Promise<boolean> => {
    const email = emailForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    try {
      const st = await adminApi.loginStart(email, emailForm.password);
      /* Dev-режим (до публикации): пароль — единственный пропуск, код не нужен.
         Сервер сразу выдаёт сессионную cookie → мгновенный тихий вход в кабинет. */
      if (st && st.ok && st.devDirect && st.profile) {
        (window as any).__QF_ADMIN__ = st.profile;
        nav("/admin", { replace: true });
        return true;
      }
      if (st && st.ok) {
        setAdminEmail(email); setAdminStep("code"); setError("");
        setAdminHint(st.devCode
          ? `Код подтверждения: ${st.devCode}. Действует 5 минут.`
          : st.devMode ? "Код отправлен на почту (dev-режим: код показан выше/в консоли сервера). Действует 5 минут." : "На почту отправлен одноразовый код. Действует 5 минут.");
        return true;
      }
    } catch { /* fallthrough */ }
    return false;
  };

  const adminVerify = async () => {
    setError(""); setBusy(true);
    try {
      const v = await adminApi.loginVerify(adminEmail, adminCode.replace(/\D/g, ""));
      setBusy(false);
      if (v && v.ok) {
        /* тихая навигация в кабинет без перезагрузки страницы (исключает мерцание) */
        (window as any).__QF_ADMIN__ = v.profile;
        nav("/admin", { replace: true });
        return;
      }
      if (v && v.error === "new_device") {
        setAdminHint(v.devCode
          ? `Новое устройство. Dev-режим: новый код — ${v.devCode}. Действует 5 минут.`
          : (v.message || "Новое устройство — запрошен новый код. Проверьте почту."));
        setAdminCode(""); return;
      }
      setAdminCode("");
      setError("Не удалось выполнить вход"); /* одна нейтральная ошибка без раскрытия причины */
    } catch { setBusy(false); setError("Не удалось выполнить вход"); }
  };

  const sendCode = () => {
    if (phone.replace(/\D/g, "").length < 10) { setError("Введите номер полностью"); return; }
    setError("");
    setCodeSent(true);
  };
  const verifyCode = () => {
    if (code !== "4242") { setError("Неверный код. Для демо введите 4242"); return; }
    setBusy(true);
    setTimeout(() => {
      /* ПУНКТ 3: демо-вход использует данные, введённые пользователем:
         имя из формы регистрации (если не введено — «Пользователь» + последние
         4 цифры телефона); роль — с выбранной вкладки регистрации, а не жёстко "buyer". */
      const digits = phone.replace(/\D/g, "");
      const fallbackName = "Пользователь" + (digits.slice(-4) || "");
      const name = reg.name.trim() || fallbackName;
      const role = regTab || "buyer";
      login({ id: "u" + Date.now(), name, email: reg.email.trim() || (phone + "@starttechpro.ru"), phone, role });
      nav(role === "seller" ? "/seller/dashboard" : "/profile");
    }, 500);
  };

  const emailLogin = async () => {
    if (!emailForm.email.includes("@")) { setError("Проверьте email"); return; }
    /* служебный email кабинета: сервер распознаёт адрес и переводит вход в шаг кода */
    if (await startAdminOtp()) return;
    if (emailForm.password.length < 6) { setError("Введите пароль (минимум 6 символов)"); return; }
    setError("");
    setBusy(true);
    const r = await authLogin(emailForm.email.trim(), emailForm.password);
    if (!r.ok) {
      const emailKey0 = emailForm.email.trim().toLowerCase();
      const vault = JSON.parse(localStorage.getItem("qf-demo-pass") || "{}");
      const localAcc = Object.values(useAppStore.getState().accounts).flat().find((a) => a.email.toLowerCase() === emailKey0);
      if (vault[emailKey0] === emailForm.password && localAcc) {
        setBusy(false);
        if (localAcc.role === "seller") { useAppStore.getState().setActiveAccount(localAcc.email, "seller", localAcc.sellerType); nav("/seller/dashboard"); }
        else { useAppStore.getState().login(localAcc); nav("/profile"); }
        return;
      }
    }
    setBusy(false);
    if (!r.ok) {
      setError(r.error === "need_confirm" ? "Email не подтверждён. Проверьте письмо (в dev-режиме ссылка в консоли сервера)." : r.error === "bad_credentials" ? "Неверный email или пароль" : "Ошибка входа, попробуйте ещё раз");
      return;
    }
    const emailKey = emailForm.email.trim().toLowerCase();
    const sellerAcc = Object.values(useAppStore.getState().accounts).flat().find((a) => a.email.toLowerCase() === emailKey && a.role === "seller");
    if (sellerAcc) {
      useAppStore.getState().setActiveAccount(sellerAcc.email, "seller", sellerAcc.sellerType);
      nav("/seller/dashboard");
    } else {
      nav("/profile");
    }
  };

  /* ПУНКТ 4: клиентская валидация email перед отправкой на сервер —
     email нет пустым, содержит @ и доменную часть (совпадает с регуляркой сервера). */
  const isValidEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

  const finishReg = async () => {
    setError("");
    /* Дополнительная проверка перед запросом — предотвращает заведомо некорректные запросы */
    if (!isValidEmail(reg.email)) { setError("Проверьте email: нужен формат name@domain.ru"); return; }
    setBusy(true);
    const r = await authRegister({ name: reg.name.trim(), email: reg.email.trim().toLowerCase(), password: reg.password, role: regTab || "buyer", legalType: "" });
    { const vk = "qf-demo-pass"; const vv = JSON.parse(localStorage.getItem(vk) || "{}"); vv[reg.email.trim().toLowerCase()] = reg.password; localStorage.setItem(vk, JSON.stringify(vv)); }
    setBusy(false);
    if (!r.ok) {
      /* ПУНКТ 4: специфичные сообщения для каждой ошибки сервера */
      setError(
        r.error === "exists" ? "Такой email уже зарегистрирован — перейдите ко входу (кнопка «Войти»)" :
        r.error === "bad_email" ? "Некорректный email — проверьте формат адреса" :
        r.error === "short_password" ? "Пароль должен быть не короче 8 символов" :
        r.error === "bad_name" ? "Имя должно быть не короче 2 символов" :
        "Ошибка регистрации, попробуйте ещё раз"
      );
      /* остаёмся на форме регистрации: пользователь может исправить данные или войти */
      return;
    }
    /* АВТОМАТИЧЕСКИЙ ВХОД: в dev-режиме (без подтверждения email) сразу
       выполняем вход и редирект в кабинет с правильным именем и ролью. */
    if (!r.needConfirm && r.userId) {
      const autoRole: UserRole = r.role === "seller" ? "seller" : "buyer";
      useAppStore.getState().login({
        id: r.userId,
        name: r.name || reg.name.trim(),
        email: r.email || reg.email.trim().toLowerCase(),
        phone: reg.phone || undefined,
        role: autoRole
      });
      nav(autoRole === "seller" ? "/seller/dashboard" : "/profile");
      return;
    }
    /* ПУНКТ 5: режим с подтверждением email — плавный переход на экран подтверждения
       без перезагрузки страницы; dev-ссылка от сервера показывается прямо на экране. */
    setConfirmInfo({ email: reg.email.trim().toLowerCase(), devUrl: r.devConfirmUrl });
  };

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-12">
      {confirmInfo && (
        <div className="max-w-[520px] mx-auto bg-surface rounded-2xl shadow-card p-7 mb-8 fade-up text-center">
          <CheckCircle2 size={34} className="text-success mx-auto mb-3" />
          <h2 className="font-display font-bold text-[22px] text-ink mb-2">Письмо отправлено</h2>
          <p className="text-[13.5px] text-ink-soft mb-4">Подтвердите email <b>{confirmInfo.email}</b> по ссылке из письма, затем войдите.</p>
          {confirmInfo.devUrl && (
            <a href={confirmInfo.devUrl} target="_blank" rel="noreferrer" className="inline-block h-11 px-5 rounded-[10px] bg-accent text-ink font-bold leading-[44px] hover:bg-accent-deep hover:text-cream transition-colors">DEV: открыть ссылку подтверждения</a>
          )}
          <div className="mt-4"><Btn variant="ghost" size="sm" onClick={() => { setConfirmInfo(null); setRegOpen(false); }}>Перейти ко входу</Btn></div>
        </div>
      )}
      {!regOpen ? (
        <div className="max-w-[480px] mx-auto fade-up">
          <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-2">Вход в Quantiform</h1>
          <p className="text-[14px] text-ink-soft mb-8">Корзина, избранное и бонусы сохранятся в аккаунте.</p>

          <div className="inline-flex bg-line-soft rounded-[12px] p-1.5 mb-7">
            {([["sms", "По телефону", Smartphone], ["email", "По email", Mail]] as const).map(([id, label, Ic]) => (
              <button key={id} onClick={() => { setTab(id); setError(""); }}
                className={`flex items-center gap-2 h-11 px-5 rounded-[10px] text-sm font-bold transition-all duration-200 cursor-pointer ${tab === id ? "bg-dark text-cream shadow-card" : "text-ink-soft hover:text-ink"}`}>
                <Ic size={16} /> {label}
              </button>
            ))}
          </div>

          {tab === "sms" ? (
            <div className="bg-surface rounded-2xl shadow-card p-7 space-y-4">
              <Field label="Номер телефона" required>
                <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" inputMode="tel" autoComplete="tel" />
              </Field>
              {codeSent && (
                <Field label="Код из SMS" hint="Демо-код: 4242" required className="fade-up">
                  <input className="field" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" inputMode="numeric" />
                </Field>
              )}
              {error && <p className="text-[13px] font-semibold text-error fade-up">{error}</p>}
              <Btn size="lg" className="w-full" disabled={busy} onClick={codeSent ? verifyCode : sendCode}>
                {busy ? "Входим…" : codeSent ? "Подтвердить код" : "Получить код"}
              </Btn>
              <p className="text-[12px] text-ink-mute text-center">Нажимая кнопку, вы принимаете условия Оферты и Политики конфиденциальности.</p>
            </div>
          ) : adminStep === "code" ? (
            /* OTP-шаг служебного входа: нейтральный, без упоминания кабинета */
            <div className="bg-surface rounded-2xl shadow-card p-7 space-y-4 fade-up">
              <Field label="Код подтверждения" required hint={adminHint}>
                <input className="field tracking-[6px] text-center font-bold text-[20px]" value={adminCode} onChange={(e) => setAdminCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" inputMode="numeric" autoComplete="one-time-code" />
              </Field>
              {error && <p className="text-[13px] font-semibold text-error fade-up">{error}</p>}
              <Btn size="lg" className="w-full" disabled={busy || adminCode.length !== 6} onClick={adminVerify}>{busy ? "Проверяем…" : "Подтвердить вход"}</Btn>
              <button onClick={() => startAdminOtp()} className="block mx-auto text-[12.5px] font-semibold text-ink-mute hover:text-ink cursor-pointer">Не получили код — отправить снова</button>
            </div>
          ) : (
            <div className="bg-surface rounded-2xl shadow-card p-7 space-y-4">
              <Field label="Email" required>
                <input className="field" type="email" autoComplete="email" inputMode="email" value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} placeholder="anna@mail.ru" />
              </Field>
              <Field label="Пароль" required>
                <PasswordInput autoComplete="current-password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} placeholder="••••••" />
              </Field>
              {error && <p className="text-[13px] font-semibold text-error fade-up">{error}</p>}
              <Btn size="lg" className="w-full" disabled={busy} onClick={emailLogin}>{busy ? "Входим…" : "Войти"}</Btn>
            </div>
          )}

          <div className="text-center mt-7 space-y-2.5">
            <p className="text-[13.5px] text-ink-soft">
              Нет аккаунта?{" "}
              <button onClick={() => { setRegOpen(true); setRegTab("buyer"); setError(""); }} className="font-bold text-accent-deep hover:text-accent cursor-pointer underline">Зарегистрироваться</button>
            </p>
            <button onClick={() => { setRegOpen(true); setRegTab("seller"); setError(""); }} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors cursor-pointer">
              <Store size={14} /> Я продавец → регистрация мастерской
            </button>
          </div>
        </div>
      ) : (
        <div className="fade-up">
          <div className="flex items-center justify-center mb-8">
            <div className="inline-flex bg-line-soft rounded-[14px] p-1.5">
              {([["buyer", "Покупатель"], ["seller", "Продавец"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setRegTab(id)}
                  className={`h-12 px-8 rounded-[10px] text-[14px] font-bold transition-all duration-200 cursor-pointer ${regTab === id ? "bg-dark text-cream shadow-card" : "text-ink-soft hover:text-ink"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {regTab === "seller" ? (
            <SellerRegWizard embedded />
          ) : (
            <div className="max-w-[520px] mx-auto">
              {/* ПУНКТ 2/6: регистрация покупателя состоит из одного шага,
                  поэтому индикатор прогресса (4 полоски) удалён как избыточный. */}
              <div className="bg-surface rounded-2xl shadow-card p-7 space-y-4 fade-up">
                <h1 className="font-display font-bold text-[24px] text-ink">Создайте аккаунт</h1>
                <Field label="Имя" required><input className="field" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder="Анна" /></Field>
                <Field label="Email" required><input className="field" type="email" autoComplete="email" inputMode="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} placeholder="anna@mail.ru" /></Field>
                <Field label="Телефон"><input className="field" value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} placeholder="+7 (___) ___-__-__" /></Field>
                <Field label="Пароль" required hint="Минимум 8 символов"><PasswordInput autoComplete="new-password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} placeholder="••••••" /></Field>
                <label className="flex items-start gap-3 cursor-pointer select-none pt-1">
                  <input type="checkbox" checked={reg.tos} onChange={(e) => setReg({ ...reg, tos: e.target.checked })} className="mt-0.5" />
                  <span className="text-[13px] text-ink-soft leading-relaxed">
                    Я принимаю условия <Link to="/legal/buyer_tos" className="font-bold text-accent-deep underline">Оферты</Link> и <Link to="/legal/privacy" className="font-bold text-accent-deep underline">Политики конфиденциальности</Link> <span className="text-error">*</span>
                  </span>
                </label>
                {error && <p className="text-[13px] font-semibold text-error fade-up">{error}</p>}
                <Btn size="lg" className="w-full" disabled={busy || !reg.tos || reg.name.trim().length < 2 || !isValidEmail(reg.email) || reg.password.length < 8}
                  onClick={finishReg}>
                  {busy ? "Создаём аккаунт…" : "Зарегистрироваться"}
                </Btn>
              </div>

              <p className="text-center mt-6 text-[13.5px] text-ink-soft">
                Уже есть аккаунт?{" "}
                <button onClick={() => setRegOpen(false)} className="font-bold text-accent-deep hover:text-accent cursor-pointer underline">Войти</button>
              </p>
            </div>
          )}
        </div>
      )}

      {busy && tab === "sms" && codeSent && (
        <p className="flex items-center justify-center gap-2 text-[13px] font-semibold text-[#4d7327] mt-5 fade-up">
          <CheckCircle2 size={16} /> Проверяем код…
        </p>
      )}
    </div>
  );
}
