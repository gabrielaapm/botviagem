import { mkdir, rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";
import { copy } from "../copy/strings.ts";
import { startsWithBotCommand } from "../inbound/parse.ts";
import { delay } from "../lib/delay.ts";
import { log } from "../lib/log.ts";
import type {
  InboundTextHandler,
  WhatsAppGateway,
  WhatsAppGroup,
  WhatsAppGroupDetails,
  WhatsAppStatus,
} from "./gateway.ts";
import { normalizeUserJid } from "./jid.ts";

type BaileysSocket = {
  ev: {
    on: (event: string, cb: (value: never) => void | Promise<void>) => void;
  };
  user?: { id?: string; name?: string };
  groupFetchAllParticipating: () => Promise<Record<string, { id: string; subject?: string }>>;
  groupMetadata: (jid: string) => Promise<{
    id: string;
    subject?: string;
    owner?: string;
    ownerJid?: string;
    participants: { id?: string; jid?: string; admin: "superadmin" | "admin" | null }[];
  }>;
  sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
};

type DisconnectStatus = { error?: { output?: { statusCode?: number } } };

type IncomingMessage = {
  key: { remoteJid?: string | null; fromMe?: boolean | null; id?: string | null };
  message?: {
    conversation?: string | null;
    extendedTextMessage?: { text?: string | null } | null;
    ephemeralMessage?: { message?: IncomingMessage["message"] } | null;
  } | null;
};

const LOGGED_OUT = 401;

export class BaileysWhatsApp implements WhatsAppGateway {
  private sock: BaileysSocket | undefined;
  private connected = false;
  private qrPath: string | undefined;
  private userName: string | undefined;
  private ownJid: string | undefined;
  private starting = false;
  private inboundHandler: InboundTextHandler | undefined;
  private recentIds = new Set<string>();

  constructor(
    private readonly dataDir: string,
    private readonly authDir: string,
  ) {}

  status(): WhatsAppStatus {
    return {
      enabled: true,
      connected: this.connected,
      qrPath: this.qrPath,
      userName: this.userName,
      ownJid: this.ownJid,
    };
  }

  setInboundTextHandler(handler: InboundTextHandler | undefined): void {
    this.inboundHandler = handler;
  }

  async start(): Promise<void> {
    if (this.starting || this.connected) return;
    this.starting = true;
    await mkdir(this.authDir, { recursive: true });
    await this.connect();
  }

  async listGroups(): Promise<WhatsAppGroup[]> {
    if (!this.sock || !this.connected) return [];
    const groups = await this.sock.groupFetchAllParticipating();
    return Object.values(groups).map((group) => ({
      jid: group.id,
      name: group.subject ?? group.id,
    }));
  }

  async getGroupDetails(groupJid: string): Promise<WhatsAppGroupDetails | undefined> {
    if (!this.sock || !this.connected) return undefined;
    try {
      const meta = await this.sock.groupMetadata(groupJid);
      return {
        jid: meta.id,
        name: meta.subject ?? meta.id,
        ownerJid: normalizeUserJid(meta.ownerJid ?? meta.owner),
        participants: meta.participants.map((p) => ({
          jid: normalizeUserJid(p.jid ?? p.id) ?? String(p.jid ?? p.id),
          admin: p.admin,
        })),
      };
    } catch (err) {
      log.warn(`não consegui ler metadados do grupo ${groupJid}`, err);
      return undefined;
    }
  }

  async sendText(jid: string, text: string): Promise<void> {
    if (!this.sock || !this.connected) {
      throw new Error(copy.errors.notConnected);
    }
    const target = jid.endsWith("@g.us") ? jid : (normalizeUserJid(jid) ?? jid);
    await this.sock.sendMessage(target, { text });
  }

  private async connect(): Promise<void> {
    const baileys = await import("@whiskeysockets/baileys");
    const { state, saveCreds } = await baileys.useMultiFileAuthState(this.authDir);
    const { version } = await baileys.fetchLatestBaileysVersion();

    const makeWASocket = baileys.default ?? baileys.makeWASocket;
    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: baileys.makeCacheableSignalKeyStore(state.keys, silentLogger()),
      },
      printQRInTerminal: false,
      browser: baileys.Browsers.ubuntu("Chrome"),
      logger: silentLogger(),
    }) as unknown as BaileysSocket;

    this.sock = sock;

    sock.ev.on("creds.update", (async () => {
      await saveCreds();
    }) as never);

    sock.ev.on("messages.upsert", (async (payload: {
      messages?: IncomingMessage[];
      type?: string;
    }) => {
      await this.onMessagesUpsert(payload);
    }) as never);

    sock.ev.on("connection.update", (async (update: {
      connection?: string;
      lastDisconnect?: DisconnectStatus;
      qr?: string;
    }) => {
      if (update.qr) {
        await this.persistQr(update.qr);
      }
      if (update.connection === "open") {
        this.connected = true;
        this.starting = false;
        this.userName = sock.user?.name ?? sock.user?.id ?? "ok";
        this.ownJid = normalizeUserJid(sock.user?.id);
        await this.clearQr();
        log.info(`WhatsApp conectado (${this.userName}${this.ownJid ? ` / ${this.ownJid}` : ""})`);
        if (this.inboundHandler) {
          log.info(
            "listener de busca registrado (DM: bot/voo+rota; grupo: só mensagens que começam com bot)",
          );
        }
      }
      if (update.connection === "close") {
        this.connected = false;
        this.starting = false;
        const code = update.lastDisconnect?.error?.output?.statusCode;
        if (code === LOGGED_OUT || code === baileys.DisconnectReason.loggedOut) {
          log.warn("sessão do WhatsApp caiu. apaga data/whatsapp-auth se o QR não aparecer e sobe de novo.");
          await rm(this.authDir, { recursive: true, force: true });
          await delay(1500);
          await this.start();
          return;
        }
        log.warn("WhatsApp desconectou, tentando de novo");
        await delay(2000);
        await this.start();
      }
    }) as never);
  }

  private async onMessagesUpsert(payload: {
    messages?: IncomingMessage[];
    type?: string;
  }): Promise<void> {
    if (!this.inboundHandler) return;
    const messages = payload.messages ?? [];
    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue;
        const jid = msg.key.remoteJid;
        if (!jid) continue;
        if (jid === "status@broadcast" || jid.endsWith("@newsletter")) continue;

        const text = extractText(msg);
        if (!text?.trim()) continue;
        const trimmed = text.trim();
        const isGroup = jid.endsWith("@g.us");
        const isDm = jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid");
        if (!isGroup && !isDm) continue;

        if (isGroup && !startsWithBotCommand(trimmed)) continue;

        log.info(`inbound ${isGroup ? "grupo" : "pv"} ← ${jid}: ${trimmed.slice(0, 120)}`);

        const messageId = msg.key.id ?? `${jid}:${trimmed.slice(0, 24)}`;
        if (this.recentIds.has(messageId)) continue;
        this.recentIds.add(messageId);
        if (this.recentIds.size > 500) {
          const first = this.recentIds.values().next().value;
          if (first) this.recentIds.delete(first);
        }
        await this.inboundHandler({ jid, text: trimmed, messageId });
      } catch (err) {
        log.warn("falha ao processar mensagem inbound", err);
      }
    }
  }

  private async persistQr(qr: string): Promise<void> {
    const path = join(this.dataDir, "whatsapp-qr.png");
    await mkdir(this.dataDir, { recursive: true });
    await QRCode.toFile(path, qr, { width: 360, margin: 2 });
    this.qrPath = path;
    qrcodeTerminal.generate(qr, { small: true });
    log.info(copy.boot.qrFile(path));
    log.info(copy.boot.qrScan);
  }

  private async clearQr(): Promise<void> {
    if (!this.qrPath) return;
    await unlink(this.qrPath).catch(() => undefined);
    this.qrPath = undefined;
  }
}

function extractText(msg: IncomingMessage): string | undefined {
  const m = msg.message;
  if (!m) return undefined;
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.ephemeralMessage?.message) {
    return extractText({ key: msg.key, message: m.ephemeralMessage.message });
  }
  return undefined;
}

function silentLogger(): {
  level: string;
  child: () => ReturnType<typeof silentLogger>;
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  fatal: (...args: unknown[]) => void;
} {
  const logger = {
    level: "silent",
    child: () => logger,
    trace: () => undefined,
    debug: () => undefined,
    info: () => undefined,
    warn: (...args: unknown[]) => {
      if (args[0]) log.warn(String(args[0]));
    },
    error: (...args: unknown[]) => {
      if (args[0]) log.error(String(args[0]));
    },
    fatal: (...args: unknown[]) => {
      if (args[0]) log.error(String(args[0]));
    },
  };
  return logger;
}
