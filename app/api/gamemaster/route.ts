import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { ChatMessage, Zone } from "@/lib/game";

const fallback = "The gamemaster is quiet for now. Add OPENAI_API_KEY to enable AI narration.";

export async function POST(request: Request) {
  const { zone, messages } = (await request.json()) as { zone: Zone; messages: ChatMessage[] };

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ text: fallback });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const recent = messages.slice(-12).map((message) => `${message.playerName ?? message.sender}: ${message.text}`).join("\n");

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    instructions: "You are a concise cooperative browser-game gamemaster. Narrate after each player input. Do not invent deep lore, stats, dice, quests, combat systems, or mechanics yet. Keep replies to 1-3 short sentences and reflect the current zone.",
    input: `Current zone: ${zone}. Recent chat:\n${recent}`,
  });

  return NextResponse.json({ text: response.output_text || fallback });
}
