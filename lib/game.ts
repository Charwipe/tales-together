export type Zone = "city" | "wilderness";
export type Sender = "player" | "gm" | "system";

export type Player = {
  id: string;
  name: string;
  ready: boolean;
  lastSeen: number;
};

export type ChatMessage = {
  id: string;
  sender: Sender;
  playerId?: string;
  playerName?: string;
  text: string;
  createdAt: number;
};

export type PartyState = {
  id: string;
  zone: Zone;
  players: Record<string, Player>;
  messages: ChatMessage[];
  updatedAt: number;
};

export const zoneLabel: Record<Zone, string> = {
  city: "The City",
  wilderness: "The Wilderness",
};

export function createId(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
