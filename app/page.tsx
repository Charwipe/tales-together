"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage, PartyState, Player, Zone, createId, zoneLabel } from "@/lib/game";

const maxPlayers = 4;
const storagePrefix = "tales-party:";

type BroadcastEvent = { party: PartyState };

function newParty(id: string): PartyState {
  return { id, zone: "city", players: {}, messages: [], updatedAt: Date.now() };
}

function loadParty(id: string) {
  if (typeof window === "undefined") return newParty(id);
  const stored = window.localStorage.getItem(`${storagePrefix}${id}`);
  return stored ? (JSON.parse(stored) as PartyState) : newParty(id);
}

export default function Home() {
  const [partyId, setPartyId] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [party, setParty] = useState<PartyState | null>(null);
  const [draft, setDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [isGmThinking, setIsGmThinking] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("party") ?? createId("party");
    if (!params.get("party")) window.history.replaceState(null, "", `/?party=${id}`);
    setPartyId(id);
    setParty(loadParty(id));
    channelRef.current = new BroadcastChannel(`tales:${id}`);
    channelRef.current.onmessage = (event: MessageEvent<BroadcastEvent>) => setParty(event.data.party);
    return () => channelRef.current?.close();
  }, []);

  useEffect(() => {
    if (!party || !partyId) return;
    window.localStorage.setItem(`${storagePrefix}${partyId}`, JSON.stringify(party));
    channelRef.current?.postMessage({ party });
  }, [party, partyId]);

  const players = useMemo(() => Object.values(party?.players ?? {}).sort((a, b) => a.name.localeCompare(b.name)), [party]);
  const allReady = players.length > 0 && players.every((member) => member.ready);

  useEffect(() => {
    if (!party || !player) return;
    const syncedPlayer = party.players[player.id];
    if (syncedPlayer && syncedPlayer.ready !== player.ready) setPlayer(syncedPlayer);
  }, [party, player]);

  function updateParty(updater: (current: PartyState) => PartyState) {
    setParty((current) => (current ? updater(current) : current));
  }

  function joinParty() {
    if (!party || !nameDraft.trim() || players.length >= maxPlayers) return;
    const nextPlayer: Player = { id: createId("player"), name: nameDraft.trim(), ready: false, lastSeen: Date.now() };
    setPlayer(nextPlayer);
    updateParty((current) => ({
      ...current,
      players: { ...current.players, [nextPlayer.id]: nextPlayer },
      messages: [...current.messages, { id: createId("msg"), sender: "system", text: `${nextPlayer.name} joined the party.`, createdAt: Date.now() }],
      updatedAt: Date.now(),
    }));
  }

  async function sendMessage() {
    if (!party || !player || !draft.trim()) return;
    const userMessage: ChatMessage = { id: createId("msg"), sender: "player", playerId: player.id, playerName: player.name, text: draft.trim(), createdAt: Date.now() };
    const withUserMessage = { ...party, messages: [...party.messages, userMessage], updatedAt: Date.now() };
    setParty(withUserMessage);
    setDraft("");
    setIsGmThinking(true);
    try {
      const response = await fetch("/api/gamemaster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zone: withUserMessage.zone, messages: withUserMessage.messages }) });
      const data = (await response.json()) as { text: string };
      setParty((current) => current ? { ...current, messages: [...current.messages, { id: createId("msg"), sender: "gm", text: data.text, createdAt: Date.now() }], updatedAt: Date.now() } : current);
    } finally {
      setIsGmThinking(false);
    }
  }

  function toggleReady() {
    if (!player) return;
    updateParty((current) => {
      const currentPlayer = current.players[player.id];
      const nextPlayer = { ...currentPlayer, ready: !currentPlayer.ready, lastSeen: Date.now() };
      setPlayer(nextPlayer);
      return { ...current, players: { ...current.players, [player.id]: nextPlayer }, updatedAt: Date.now() };
    });
  }

  function switchZone() {
    if (!party || !allReady) return;
    const nextZone: Zone = party.zone === "city" ? "wilderness" : "city";
    if (player) setPlayer({ ...player, ready: false });
    updateParty((current) => ({
      ...current,
      zone: nextZone,
      players: Object.fromEntries(Object.values(current.players).map((member) => [member.id, { ...member, ready: false }])),
      messages: [...current.messages, { id: createId("msg"), sender: "system", text: `The party moves to ${zoneLabel[nextZone]}.`, createdAt: Date.now() }],
      updatedAt: Date.now(),
    }));
  }

  if (!party) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 text-zinc-100 md:grid md:grid-cols-[1fr_380px]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30">
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Current zone</p>
        <h1 className="mt-3 text-4xl font-semibold">{zoneLabel[party.zone]}</h1>
        <p className="mt-4 max-w-2xl text-zinc-400">A plain shared room for the party. Use chat to act, then ready up when everyone wants to switch zones.</p>
        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between gap-3"><h2 className="font-medium">Party readiness</h2><span className="text-sm text-zinc-500">{players.length}/{maxPlayers} players</span></div>
          <div className="mt-4 grid gap-2">
            {players.map((member) => <div key={member.id} className="flex justify-between rounded-xl bg-zinc-950 px-3 py-2 text-sm"><span>{member.name}</span><span className={member.ready ? "text-emerald-400" : "text-zinc-500"}>{member.ready ? "ready" : "not ready"}</span></div>)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={toggleReady} disabled={!player} className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-40">{player?.ready ? "Cancel ready" : "Ready to switch"}</button>
            <button onClick={switchZone} disabled={!allReady} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm disabled:opacity-40">Switch to {zoneLabel[party.zone === "city" ? "wilderness" : "city"]}</button>
          </div>
        </div>
      </section>

      <aside className="flex min-h-[70vh] flex-col rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="border-b border-zinc-800 pb-3">
          <h2 className="text-lg font-semibold">Party chat</h2>
          <button className="mt-2 text-xs text-zinc-400 underline" onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy invite link</button>
        </div>
        {!player ? <div className="my-4 flex gap-2"><input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="Player name" className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none" /><button onClick={joinParty} className="rounded-xl bg-zinc-100 px-4 py-2 text-zinc-950">Join</button></div> : null}
        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {party.messages.map((message) => <article key={message.id} className="rounded-2xl bg-zinc-900 p-3 text-sm"><p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">{message.playerName ?? message.sender}</p><p className="whitespace-pre-wrap leading-relaxed">{message.text}</p></article>)}
          {isGmThinking ? <p className="text-sm text-zinc-500">Gamemaster is thinking…</p> : null}
        </div>
        <div className="flex gap-2 border-t border-zinc-800 pt-3"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!player} placeholder={player ? "What do you do?" : "Join to chat"} className="min-h-12 flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none" /><button onClick={sendMessage} disabled={!player || !draft.trim()} className="rounded-xl bg-zinc-100 px-4 py-2 text-zinc-950 disabled:opacity-40">Send</button></div>
      </aside>
    </main>
  );
}
