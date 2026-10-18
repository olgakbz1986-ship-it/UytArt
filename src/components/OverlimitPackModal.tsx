import { useState } from "react";
import { Link } from "react-router-dom";
import { Modal, Btn } from "./ui";
import { useTariffStore, type TariffAction } from "../lib/tariff";

/**
 * §4.5: Модалка покупки пакета сверх лимита.
 * Показывается в момент отказа (LimitReachedError): предлагает
 * «+50 слотов товаров за 300 ₽/мес» и «+50 генераций за 500 ₽/мес».
 * Покупка идёт через серверный POST /api/limits/buy-pack — лимит
 * открывается в базе, клиентский кэш сбрасывается (источник истины — сервер).
 */

export interface PackInfo {
  title: string;
  desc: string;
  price: number;
}

const PACK_BY_ACTION: Partial<Record<TariffAction, PackInfo>> = {
  product_create: { title: "+50 слотов товаров", desc: "К 50 товарам вашего тарифа на месяц. Автопродление, отмена в любой момент.", price: 300 },
  ai_card_gen: { title: "+50 AI-генераций карточек", desc: "Сверх месячного пакета генераций. Списание — по факту запуска.", price: 500 },
  ai_gen: { title: "+50 AI-генераций", desc: "Фото-поиск, концепты, проекты интерьера — сверх пакета тарифа.", price: 500 },
};

export function packForAction(action: TariffAction): PackInfo | null {
  return PACK_BY_ACTION[action] ?? null;
}

export default function OverlimitPackModal({
  open,
  action,
  reason,
  onClose,
}: {
  open: boolean;
  action: TariffAction;
  reason?: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<PackInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pack = packForAction(action);

  const buy = async () => {
    if (!pack) return;
    setBusy(true);
    setErr(null);
    try {
      await useTariffStore.getState().buyOverlimitPack(action === "product_create" ? "products" : "generations");
      setDone(pack);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Платёж не прошёл, попробуйте позже");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Докупить сверх лимита">
      {done ? (
        <div className="text-center py-2">
          <p className="text-[34px] mb-2">✅</p>
          <h4 className="font-display font-bold text-[17px] text-ink mb-1">Пакет «{done.title}» активирован</h4>
          <p className="text-[13px] text-ink-mute mb-4">Лимит обновлён на сервере — счётчики пересчитаны автоматически.</p>
          <Btn onClick={onClose}>Продолжить работу</Btn>
        </div>
      ) : (
        <>
          {reason && <p className="text-[13px] text-ink-soft mb-3">{reason}</p>}
          {pack ? (
            <div className="rounded-xl border border-line bg-paper p-4 mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-[15px] text-ink">{pack.title}</p>
                <p className="font-display font-bold text-[16px] text-accent-deep">{pack.price} ₽/мес</p>
              </div>
              <p className="text-[12.5px] text-ink-mute">{pack.desc}</p>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-mute mb-3">Для этого лимита пакеты добора не продаются — доступен переход на тариф выше.</p>
          )}
          {err && <p className="text-[12.5px] text-error mb-3">{err}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Link to="/plans" onClick={onClose} className="inline-flex items-center h-10 px-4 rounded-[10px] border border-line text-sm font-bold text-ink hover:border-ink transition-colors">
              Тарифы выше
            </Link>
            {pack && (
              <Btn disabled={busy} onClick={() => void buy()}>
                Купить за {pack.price} ₽
              </Btn>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
