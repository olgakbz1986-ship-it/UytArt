/* ---------- валидация ИНН по алгоритму контрольных сумм ФНС ---------- */

export interface InnCheckResult {
  valid: boolean;
  digits: 0 | 10 | 12;
  error?: string;
}

const N10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const N11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const N12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

const checksum = (digits: number[], coeffs: number[]): number =>
  (digits.reduce((sum, d, i) => sum + d * coeffs[i], 0) % 11) % 10;

export function validateINN(raw: string): InnCheckResult {
  const inn = (raw || "").trim();
  if (!/^\d+$/.test(inn)) {
    return { valid: false, digits: 0, error: "ИНН может содержать только цифры" };
  }
  if (inn.length === 10) {
    const d = inn.split("").map(Number);
    const ok = checksum(d.slice(0, 9), N10) === d[9];
    return ok
      ? { valid: true, digits: 10 }
      : { valid: false, digits: 10, error: "Неверная контрольная сумма ИНН (10 цифр)" };
  }
  if (inn.length === 12) {
    const d = inn.split("").map(Number);
    const ok11 = checksum(d.slice(0, 10), N11) === d[10];
    const ok12 = checksum(d.slice(0, 11), N12) === d[11];
    return ok11 && ok12
      ? { valid: true, digits: 12 }
      : { valid: false, digits: 12, error: "Неверная контрольная сумма ИНН (12 цифр)" };
  }
  return { valid: false, digits: 0, error: "ИНН должен содержать 10 или 12 цифр" };
}

/* ---------- валидация ОГРН/ОГРНИП по алгоритму ФНС ---------- */
// NOTE: формулы по открытым данным; ОГРНИП сверить на эталонных номерах при подключении реестра.
export interface OgrnCheckResult { valid: boolean; error?: string; }

const OGRN_IP_W = [2, 4, 10, 3, 5, 9, 4, 6, 8, 10, 3, 5, 9, 4];

export function validateOGRN(raw: string): OgrnCheckResult {
  const g = (raw || "").trim();
  if (!/^\d+$/.test(g)) return { valid: false, error: "ОГРН может содержать только цифры" };
  if (g.length !== 15) return { valid: false, error: "ОГРН должен содержать 15 цифр" };
  const d = g.split("").map(Number);
  const last = d[14];
  if (g[0] === "1") {
    const ctrl = Number(g.slice(0, 14)) % 13 % 10;
    return ctrl === last ? { valid: true } : { valid: false, error: "Неверная контрольная сумма ОГРН" };
  }
  if (g[0] === "3") {
    const sum = d.slice(0, 14).reduce((s, x, i) => s + x * OGRN_IP_W[i], 0);
    const ctrl = (sum % 11) % 10;
    return ctrl === last ? { valid: true } : { valid: false, error: "Неверная контрольная сумма ОГРНИП" };
  }
  return { valid: false, error: "ОГРН должен начинаться с 1 (юрлицо) или 3 (ИП)" };
}

/* ---------- автозаполнение реквизитов по ИНН ---------- */

export interface CompanyData {
  legalName: string;
  legalType: "self_employed" | "ip" | "ooo";
  ogrn: string;
  legalAddress: string;
  status: "active" | "liquidated" | "reorganizing";
  registrationDate: string;
  source: "api" | "demo";
  productionCity?: string;
}

/* TODO: после публикации подключить прокси к ФНС/DaData на server/index.cjs.
   Сейчас оффлайн-режим: возвращаем null, UI показывает ручной ввод. */
export async function fetchCompanyDataByINN(inn: string): Promise<CompanyData | null> {
  const v = validateINN(inn);
  if (!v.valid) return null;
  // Заглушка: реальный запрос будет добавлен после публикации
  return null;
}
