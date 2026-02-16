"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Game = {
  id: string;
  game_date: string;
  opponent: string | null;
  memo: string | null;
  submitted_names: string[];
};

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("読み込み中…");
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/games");
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json.ok) {
          setStatus("エラー: " + (json.error ?? res.statusText));
          return;
        }

        setGames((json.games ?? []) as Game[]);
        setStatus("OK");
      } catch (e: any) {
        setStatus("例外: " + (e?.message ?? String(e)));
      }
    })();
  }, []);

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>試合一覧</h1>
      <p style={{ marginTop: 8 }}>{status}</p>

      <ul style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {games.map((g) => (
          <li key={g.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 800 }}>{g.game_date}</div>
            <div style={{ marginTop: 4, color: "#444" }}>vs {g.opponent ?? "（未入力）"}</div>
            {g.memo && <div style={{ marginTop: 6, color: "#666" }}>{g.memo}</div>}

            {g.submitted_names?.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>入力済み</div>
                <div style={{ color: "#333", lineHeight: 1.5 }}>{g.submitted_names.join(" / ")}</div>
              </div>
            )}

            <button
              type="button"
              onClick={() => router.push(`/game/${g.id}`)}
              style={{
                marginTop: 12,
                width: "100%",
                textAlign: "left",
                border: "1px solid #0a66c2",
                borderRadius: 12,
                padding: "12px 12px",
                background: "white",
                color: "#0a66c2",
                fontWeight: 800,
              }}
            >
              この試合の成績を入力 →
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

