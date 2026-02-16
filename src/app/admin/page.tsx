"use client";

import { useEffect, useState } from "react";

type Game = {
  id: string;
  game_date: string;
  opponent: string | null;
  memo: string | null;
};

export default function AdminPage() {
  const [status, setStatus] = useState("確認中…");
  const [isAdmin, setIsAdmin] = useState(false);

  const [gameDate, setGameDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [memo, setMemo] = useState("");

  const [saving, setSaving] = useState(false);
  const [games, setGames] = useState<Game[]>([]);

  const load = async () => {
    const res = await fetch("/api/admin/games");
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      setStatus("エラー: " + (json.error ?? res.statusText));
      setIsAdmin(false);
      return;
    }
    setIsAdmin(true);
    setGames(json.games ?? []);
    setStatus("OK（管理者）");
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    try {
      if (!gameDate) {
        setStatus("入力エラー：試合日を入れてください");
        return;
      }
      setSaving(true);
      setStatus("作成中…");

      const res = await fetch("/api/admin/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_date: gameDate,
          opponent: opponent || null,
          memo: memo || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setStatus("作成エラー: " + (json.error ?? res.statusText));
        return;
      }

      setStatus("作成しました ✅");
      setGameDate("");
      setOpponent("");
      setMemo("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <main style={{ padding: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>管理者</h1>
        <p style={{ marginTop: 8 }}>{status}</p>
        <p style={{ marginTop: 12, color: "#666", lineHeight: 1.6 }}>
          管理者権限がありません。<br />
          Supabaseで users.is_admin を true にしてください。
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, display: "grid", gap: 14 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>管理者：試合作成</h1>
      <p>{status}</p>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>新しい試合を追加</div>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 700 }}>試合日（必須）</div>
          <input
            type="date"
            value={gameDate}
            onChange={(e) => setGameDate(e.target.value)}
            style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, fontSize: 16 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 700 }}>対戦相手</div>
          <input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="例）Red Sox"
            style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, fontSize: 16 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 700 }}>メモ</div>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例）雨、ナイター、など"
            style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, fontSize: 16 }}
          />
        </label>

        <button
          onClick={onCreate}
          disabled={saving}
          style={{
            borderRadius: 12,
            padding: "12px 14px",
            border: "1px solid #0a66c2",
            background: saving ? "#eee" : "#0a66c2",
            color: saving ? "#333" : "white",
            fontWeight: 800,
          }}
        >
          {saving ? "作成中…" : "試合を作成する"}
        </button>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>登録済み試合</div>
        <ul style={{ display: "grid", gap: 10 }}>
          {games.map((g) => (
            <li key={g.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800 }}>{g.game_date}</div>
              <div style={{ marginTop: 4, color: "#444" }}>vs {g.opponent ?? "（未入力）"}</div>
              {g.memo && <div style={{ marginTop: 6, color: "#666" }}>{g.memo}</div>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
