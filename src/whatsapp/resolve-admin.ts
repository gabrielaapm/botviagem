import type { Config } from "../config/env.ts";
import { log } from "../lib/log.ts";
import type { WhatsAppGateway } from "./gateway.ts";
import { normalizeUserJid, sameWhatsAppUser } from "./jid.ts";

let warnedMissingAdmin = false;

/**
 * Resolve who should get the private Google Flights link after a group post.
 * Prefer WHATSAPP_ADMIN_JID / ADMIN_WHATSAPP_JID; else group owner/admin ≠ bot.
 */
export async function resolveAdminJid(opts: {
  config: Config;
  whatsapp: WhatsAppGateway;
  groupJid: string | undefined;
}): Promise<string | undefined> {
  const configured = normalizeUserJid(opts.config.whatsappAdminJid);
  const own = normalizeUserJid(opts.whatsapp.status().ownJid);

  if (configured) {
    if (sameWhatsAppUser(configured, own)) {
      if (!warnedMissingAdmin) {
        warnedMissingAdmin = true;
        log.warn(
          "WHATSAPP_ADMIN_JID é o mesmo número do bot — DM do link seria pra si mesmo. Configure outro número (adm/cliente).",
        );
      }
      return undefined;
    }
    return configured;
  }

  if (!opts.groupJid || !opts.whatsapp.status().connected) {
    warnOnce();
    return undefined;
  }

  const details = await opts.whatsapp.getGroupDetails(opts.groupJid);
  if (!details) {
    warnOnce();
    return undefined;
  }

  const candidates: string[] = [];
  if (details.ownerJid) candidates.push(details.ownerJid);
  for (const p of details.participants) {
    if (p.admin === "superadmin" || p.admin === "admin") candidates.push(p.jid);
  }
  for (const p of details.participants) candidates.push(p.jid);

  for (const raw of candidates) {
    const jid = normalizeUserJid(raw);
    if (!jid) continue;
    if (sameWhatsAppUser(jid, own)) continue;
    return jid;
  }

  warnOnce();
  return undefined;
}

function warnOnce(): void {
  if (warnedMissingAdmin) return;
  warnedMissingAdmin = true;
  log.warn(
    "sem WHATSAPP_ADMIN_JID e sem outro participante/adm no grupo — pulando DM do link Google Flights.",
  );
}
