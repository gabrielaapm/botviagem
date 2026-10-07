export type WhatsAppGroup = {
  jid: string;
  name: string;
};

export type WhatsAppGroupParticipant = {
  jid: string;
  admin: "superadmin" | "admin" | null;
};

export type WhatsAppGroupDetails = {
  jid: string;
  name: string;
  ownerJid: string | undefined;
  participants: WhatsAppGroupParticipant[];
};

export type WhatsAppStatus = {
  enabled: boolean;
  connected: boolean;
  qrPath: string | undefined;
  userName: string | undefined;
  ownJid: string | undefined;
};

export type InboundTextHandler = (msg: {
  jid: string;
  text: string;
  messageId: string;
}) => Promise<void>;

export interface WhatsAppGateway {
  status(): WhatsAppStatus;
  start(): Promise<void>;
  listGroups(): Promise<WhatsAppGroup[]>;
  getGroupDetails(groupJid: string): Promise<WhatsAppGroupDetails | undefined>;
  sendText(jid: string, text: string): Promise<void>;
  /** Register inbound text listener (DMs + group messages that start with "bot"). */
  setInboundTextHandler(handler: InboundTextHandler | undefined): void;
}
