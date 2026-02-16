"use client";

import { useEffect, useState } from "react";

type LiffProfile = { userId: string; displayName: string };

type Liff = {
  init: (arg: { liffId: string; withLoginOnExternalBrowser?: boolean }) => Promise<void>;
  ready: Promise<void>;
  isLoggedIn: () => boolean;
  login: (arg?: { redirectUri?: string }) => void;
  getProfile: () => Promise<LiffProfile>;
  isInClient: () => boolean;
};

declare global {
  interface Window {
    liff: Liff;
  }
}

type Game = {
  id: string;
  game_date: string;
  opponent: string | null;
  memo: string | null;
};

export default function AdminPage() {
  const [status, setStatus] = useState("起動中…");
  const [inClient, setInClient] = useState(false);

  const [lineUserId, setLineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [gameDate, setGameDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [memo, setMemo] = useState("");

  const [saving, setSaving] = useState(false);
  const [games, setGames] = useState<Game[]>([]);

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const loadGames = async (uid: string) => {
    const res = await fetch("/api/admin/games", {
      method: "GET",
      headers: {
        "x-line-user-id": uid,
      },
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.ok) {
      setStatus("エラー: " + (json.error ?? res.statusText));
      return;
    }
    setGames(json.games ?? []);
    setStatus("OK（管理者）");
  };

  useEffect(() => {
    (async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          setStatus("LIFF ID 未設定（Vercel Envを確認）");
          return;
        }
        if (!window.liff) {
          setStatus("LIFF SDK未読み込み（layout.tsx の script を確認）");
          return;
        }

        await window.liff.init({ liffId, withLoginOnExternalBrowser: true });
        await window.liff.ready;

        const client = window.liff.isInClient();
        setInClient(client);

        // ローカル開発だけ DEV_USER を許可
        if (isLocalhost && !client) {
          setLineUserId("DEV_USER");
          setDisplayName("Dev User");
          await loadGames("DEV_USER");
          return;
        }

        if (!window.liff.isLoggedIn()) {
          setStatus("LINEログインへ遷移します…");
          window.liff.login({ redirectUri: window.location.href });
          return;
        }

        setStatus("プロフィール取得中…");
        const profile = await window.liff.getProfile();
        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);

        setStatus("試合一覧取得中…");
        await loadGames(profile.userId);
      } catch (e: any) {
        setStatus("例外: " + (e?.message ?? String(e)));
      }
    })();
  }, [isLocalhost]);

  const onCreate = async () => {
    try {
      if (!gameDate) {
        setStatus("入力エラー：試合日を入れてください");
        return;
      }
      if (!lineUserId) {
        setStatus("ユーザー情報取得中です（少し待ってください）");
        return;
      }

      setSaving(true);
      setStatus("作成中…");

      const res = await fetch("/api/admin/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-line-user-id": lineUserId,
          "x-display-name": displayName,
        },
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

      await loadGames(lineUserId);
    } catch (e: any) {
      setStatus("例外: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: 16, display: "grid", gap: 14 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>管理者：試合作成</h1>

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <div>状態：{status}</div>
        <div style={{ fontSize: 12, color: "#666" }}>inClient: {String(inClient)}</div>
        {lineUserId && (
          <div style={{ fontSize: 12, color: "#666" }}>
            {displayName}（{lineUserId}）
          </div>
        )}
      </div>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
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
