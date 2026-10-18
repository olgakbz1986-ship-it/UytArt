/* ============================================================
   БЛОК 3, Пункт 3.1: ТОКЕНИЗАЦИЯ ПЛАТЕЖЕЙ (виджет ЮKassa)
   ------------------------------------------------------------
   Мы НИКОГДА не собираем номер карты, CVV и срок действия в своих
   полях ввода. Виджет ЮKassa создаёт iframe на стороне клиента:
   пользователь вводит данные карты внутри iframe, они уходят
   напрямую в ЮKassa, а нам возвращается только payment_method_token.

   Токен имеет форму "pm-XXXX-XXXXXXXX". Если скрипт виджета ещё не
   загружен (или платёжный метод выбран некарточный — СБП/кошелёк),
   возвращаем null: сервер продолжит обработку по выбранному способу
   оплаты (в dev — мок-режим провайдера).

   Данные карты на наш сервер не передаются никогда: в формах оплаты
   нет input-полей для PAN/CVV/сроков действия.

   Подключение виджета (index.html):
   <script src="https://yandex.st/payments/widget/2/beta/widget.js"
           data-instance-id="<instanceId из ЛК ЮKassa>" async></script>
   ============================================================ */

export const PM_TOKEN_RE = /^pm-[a-z0-9]+-[a-z0-9]{6,64}$/;

/** Загруженный SDK виджета ЮKassa (window.YooKassaCheckout / ymk). */
function getWidgetSdk(): any {
  const w = window as any;
  return w.YooKassaCheckout || w.ymk || null;
}

/**
 * Возвращает payment_method_token для токенизированной оплаты картой.
 * null — токен не требуется (СБП/кошелёк) или виджет недоступен (dev-мок).
 */
export async function getPaymentMethodToken(): Promise<string | null> {
  const w = window as any;
  /* 1) токен из уже завершённой авторизации метода в текущей checkout-сессии */
  if (typeof w.__qfPmToken === "string" && PM_TOKEN_RE.test(w.__qfPmToken)) return w.__qfPmToken;
  /* 2) всплывающий виджет: iframe ЮKassa принимает карту, нам — только токен */
  const sdk = getWidgetSdk();
  if (sdk && typeof sdk.createPaymentWidget === "function" && sdk.instanceId) {
    try {
      const widget = await sdk.createPaymentWidget({ instanceId: sdk.instanceId });
      const pm = await widget.open(); /* данные карты уходят напрямую в ЮKassa */
      const token = pm && (pm.token || (pm.payment_method && pm.payment_method.token));
      if (typeof token === "string" && PM_TOKEN_RE.test(token)) {
        w.__qfPmToken = token; /* переиспользуется до завершения оформления */
        return token;
      }
    } catch (e) {
      /* пользователь закрыл виджет — прерываем оплату без ошибки сервера */
      console.warn("[YooKassa widget] payment_method_token не получен:", e);
      return null;
    }
  }
  return null; /* карточный токен не требуется или прод-виджет не настроен (dev) */
}

/** Очистка токена после успешного/отменённого платежа. */
export function clearPaymentMethodToken() {
  (window as any).__qfPmToken = null;
}
