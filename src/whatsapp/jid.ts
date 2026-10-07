/** Normalize WhatsApp user JID (strip device suffix like :77). */
export function normalizeUserJid(jid: string | undefined | null): string | undefined {
  if (!jid) return undefined;
  const trimmed = jid.trim();
  if (!trimmed) return undefined;
  if (trimmed.endsWith("@g.us")) return trimmed;

  // bare phone / +E.164
  if (!trimmed.includes("@")) {
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return undefined;
    return `${digits}@s.whatsapp.net`;
  }

  const [userPart, domain = "s.whatsapp.net"] = trimmed.split("@");
  if (!userPart) return undefined;
  const user = userPart.split(":")[0];
  if (!user) return undefined;
  const host = domain.includes("lid") ? domain : "s.whatsapp.net";
  return `${user}@${host}`;
}

/** Digits only, for comparison. */
export function phoneDigits(jid: string | undefined | null): string | undefined {
  const n = normalizeUserJid(jid);
  if (!n || n.endsWith("@g.us")) return undefined;
  return n.split("@")[0]?.replace(/\D/g, "") || undefined;
}

/**
 * True if both JIDs are the same WhatsApp user.
 * Handles BR mobile with/without the extra 9 after DDD
 * (e.g. 558498541324 ≈ 5584998541324).
 */
export function sameWhatsAppUser(a: string | undefined, b: string | undefined): boolean {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  return brMobileEquivalent(da, db);
}

function brMobileEquivalent(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  // 55 + DDD(2) + 8 digits  vs  55 + DDD(2) + 9 + 8 digits
  if (short.length === 12 && long.length === 13 && short.startsWith("55") && long.startsWith("55")) {
    const ddd = short.slice(2, 4);
    const local8 = short.slice(4); // 8 digits
    // long: 55 + ddd + '9' + local8
    return long === `55${ddd}9${local8}`;
  }
  return false;
}
