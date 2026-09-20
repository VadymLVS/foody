/**
 * Код приглашения, открытого до входа (п. 31). Живёт в sessionStorage:
 * после регистрации человек возвращается на /join/<код>, а не в пустую кухню.
 */
const KEY = 'pantrysync:pending-invite';

export const pendingInvite = {
  get(): string | null {
    try { return sessionStorage.getItem(KEY); } catch { return null; }
  },
  set(code: string) {
    try { sessionStorage.setItem(KEY, code); } catch { /* приватный режим */ }
  },
  clear() {
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  },
};
