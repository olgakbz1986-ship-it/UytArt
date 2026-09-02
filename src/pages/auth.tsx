import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Smartphone, Mail, CheckCircle2, Info, Sparkles, Store } from "lucide-react";
import { useAppStore } from "../lib/store";
import { Btn, Field } from "../components/ui";
import { SellerRegWizard } from "./extras";

/* ============================================================
   /auth — вход (SMS / email) и регистрация с переключателем
   «Покупатель / Продавец» (самозанятый, ИП, ООО — внутри мастера)
   ============================================================ */
export function AuthPage() {
  const [sp] = useSearchParams();
  const login = useAppStore((s) => s.login);
  const nav = useNavigate();

  const [tab, setTab] = useState<"sms" | "email">("sms");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [emailForm, setEmailForm] = useState({ email: "", password: "" });
  const [regOpen, setRegOpen] = useState(sp.get("mode") === "register");
  const [regTab, setRegTab] = useState<"buyer" | "seller">(sp.get("role") === "seller" ? "seller" : "buyer");
  const [reg, setReg] = useState({ stage: 1, name: "", email: "", phone: "", password: "", tos: false, ai: false, styles: [] as string[] });

  /* ---------- быстрый вход по SMS ---------- */
  const sendCode = () => {
    if (phone.replace(/\D/g, "").length < 10) { setError("Введите номер полностью"); return; }
    setError("");
    setCodeSent(true);
  };
  const verifyCode = () => {
    if (code !== "4242") { setError("Неверный код. Для демо введите 4242"); return; }
    setBusy(true);
    setTimeout(() => {
      login({ id: "u" + Date.now(), name: "Покупатель УютАрт", email: phone + "@uyutart.ru", phone, role: "buyer" });
      nav("/profile");
    }, 500);
  };

  const emailLogin = () => {
    if (!emailForm.email.includes("@") || emailForm.password.length < 6) { setError("Проверьте email и пароль (минимум 6 символов)"); return; }
    setError("");
    setBusy(true);
    setTimeout(() => {
      login({ id: "u" + Date.now(), name: emailForm.email.split("@")[0], email: emailForm.email, role: "buyer" });
      nav("/profile");
    }, 500);
  };

  /* ---------- 4 стадии регистрации покупателя ---------- */
  const STYLES8 = ["Сканди", "Лофт", "Джапанди", "Неоклассика", "Бохо", "Минимализм", "Прованс", "Эко"];
  const finishReg = () => {
    setBusy(true);
    setTimeout(() => {
      login({ id: "u" + Date.now(), name: reg.name, email: reg.email, phone: reg.phone, role: "buyer" });
      nav("/profile");
    }, 600);
  };

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-12">
      {!regOpen ? (
        <div className="max-w-[480px] mx-auto fade-up">
          <h1 className="font-display font-bold text-[clamp(26px,3vw,34px)] text-ink mb-2">Вход в УютАрт</h1>
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
                <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" inputMode="tel" />
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
          ) : (
            <div className="bg-surface rounded-2xl shadow-card p-7 space-y-4">
              <Field label="Email" required>
                <input className="field" type="email" value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} placeholder="anna@mail.ru" />
              </Field>
              <Field label="Пароль" required>
                <input className="field" type="password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} placeholder="••••••" />
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
          {/* переключатель Покупатель / Продавец */}
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
              {/* прогресс стадий */}
              <div className="flex items-center gap-2 mb-7">
                {[1, 2, 3, 4].map((s) => (
                  <span key={s} className={`h-1.5 rounded-full transition-all duration-300 flex-1 ${s <= reg.stage ? "bg-accent" : "bg-line-soft"}`} />
                ))}
              </div>

              {reg.stage === 1 && (
                <div className="bg-surface rounded-2xl shadow-card p-7 space-y-4">
                  <h1 className="font-display font-bold text-[24px] text-ink">Создайте аккаунт</h1>
                  <Field label="Имя" required><input className="field" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder="Анна" /></Field>
                  <Field label="Email" required><input className="field" type="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} placeholder="anna@mail.ru" /></Field>
                  <Field label="Телефон"><input className="field" value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} placeholder="+7 (___) ___-__-__" /></Field>
                  <Field label="Пароль" required hint="Минимум 6 символов"><input className="field" type="password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} placeholder="••••••" /></Field>
                  <label className="flex items-start gap-3 cursor-pointer select-none pt-1">
                    <input type="checkbox" checked={reg.tos} onChange={(e) => setReg({ ...reg, tos: e.target.checked })} className="mt-0.5" />
                    <span className="text-[13px] text-ink-soft leading-relaxed">
                      Я принимаю условия <Link to="/legal/buyer_tos" className="font-bold text-accent-deep underline">Оферты</Link> и <Link to="/legal/privacy" className="font-bold text-accent-deep underline">Политики конфиденциальности</Link> <span className="text-error">*</span>
                    </span>
                  </label>
                  <Btn size="lg" className="w-full" disabled={!reg.tos || reg.name.trim().length < 2 || !reg.email.includes("@") || reg.password.length < 6}
                    onClick={() => setReg({ ...reg, stage: 2 })}>
                    Продолжить
                  </Btn>
                </div>
              )}

              {reg.stage === 2 && (
                <div className="bg-surface rounded-2xl shadow-card p-7">
                  <h1 className="font-display font-bold text-[24px] text-ink mb-1.5">Что вам нравится?</h1>
                  <p className="text-[13.5px] text-ink-soft mb-6">AI-дизайнер будет учитывать это в подборках.</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {["Декор и дом", "Одежда и обувь", "Аксессуары", "Техника", "Фурнитура", "Быт и сад", "Красота", "Хобби"].map((c) => (
                      <label key={c} className="flex items-center gap-2.5 border border-line rounded-xl px-4 py-3 cursor-pointer hover:border-dark transition-colors text-[13.5px] font-semibold text-ink">
                        <input type="checkbox" defaultChecked /> {c}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-3 mt-7">
                    <Btn variant="outline" className="flex-1" onClick={() => setReg({ ...reg, stage: 1 })}>Назад</Btn>
                    <Btn className="flex-1" onClick={() => setReg({ ...reg, stage: 3 })}>Дальше</Btn>
                  </div>
                </div>
              )}

              {reg.stage === 3 && (
                <div className="bg-surface rounded-2xl shadow-card p-7">
                  <h1 className="font-display font-bold text-[24px] text-ink mb-1.5">Ваш стиль</h1>
                  <p className="text-[13.5px] text-ink-soft mb-6">Выберите хотя бы два направления.</p>
                  <div className="flex flex-wrap gap-2">
                    {STYLES8.map((s) => {
                      const on = reg.styles.includes(s);
                      return (
                        <button key={s} onClick={() => setReg({ ...reg, styles: on ? reg.styles.filter((x) => x !== s) : [...reg.styles, s] })}
                          className={`px-4 min-h-[44px] rounded-full text-[13px] font-bold transition-all duration-200 cursor-pointer ${on ? "bg-dark text-cream" : "bg-line-soft text-ink-soft hover:bg-line"}`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 mt-7">
                    <Btn variant="outline" className="flex-1" onClick={() => setReg({ ...reg, stage: 2 })}>Назад</Btn>
                    <Btn className="flex-1" disabled={reg.styles.length < 2} onClick={() => setReg({ ...reg, stage: 4 })}>Дальше</Btn>
                  </div>
                </div>
              )}

              {reg.stage === 4 && (
                <div className="bg-surface rounded-2xl shadow-card p-7 text-center">
                  <span className="inline-flex w-16 h-16 rounded-full bg-ai-soft text-ai items-center justify-center mb-5"><Sparkles size={30} /></span>
                  <h1 className="font-display font-bold text-[24px] text-ink mb-2">Персональные рекомендации</h1>
                  <p className="text-[13.5px] text-ink-soft leading-relaxed max-w-sm mx-auto mb-5">
                    Мы подберём товары под стили «{reg.styles.join("», «")}» и ваши интересы.
                    AI-персонализацию можно включить прямо сейчас.
                  </p>
                  <div className="text-left mb-6">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input type="checkbox" checked={reg.ai} onChange={(e) => setReg({ ...reg, ai: e.target.checked })} className="mt-0.5" />
                      <span className="text-[13px] text-ink-soft flex items-start gap-1.5">
                        <Info size={15} className="text-ai shrink-0 mt-0.5" /> Разрешаю использовать данные для AI-персонализации (необязательно)
                      </span>
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <Btn variant="outline" className="flex-1" onClick={() => setReg({ ...reg, stage: 3 })}>Назад</Btn>
                    <Btn className="flex-1" disabled={busy} onClick={finishReg}>{busy ? "Создаём аккаунт…" : "Зарегистрироваться"}</Btn>
                  </div>
                </div>
              )}

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
