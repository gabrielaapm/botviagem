import { log } from "../lib/log.ts";
import type {
  InboundTextHandler,
  WhatsAppGateway,
  WhatsAppGroup,
  WhatsAppGroupDetails,
  WhatsAppStatus,
} from "./gateway.ts";

export class DisabledWhatsApp implements WhatsAppGateway {
  status(): WhatsAppStatus {
    return {
      enabled: false,
      connected: false,
      qrPath: undefined,
      userName: undefined,
      ownJid: undefined,
    };
  }

  async start(): Promise<void> {
    log.info("WhatsApp desligado (WHATSAPP_ENABLED=false)");
  }

  async listGroups(): Promise<WhatsAppGroup[]> {
    return [];
  }

  async getGroupDetails(_groupJid: string): Promise<WhatsAppGroupDetails | undefined> {
    return undefined;
  }

  async sendText(_jid: string, text: string): Promise<void> {
    log.info("prévia da mensagem (WhatsApp desligado):\n" + text);
  }

  setInboundTextHandler(_handler: InboundTextHandler | undefined): void {
    // no-op
  }
}
