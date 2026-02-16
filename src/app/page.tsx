"use client";

import { useEffect, useState } from "react";

type Liff = {
  init: (arg: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: () => void;
  getProfile: () => Promise<{ userId: string; displayName: string }>;
};

declare global {
  interface Window {
    liff: Liff;
  }
}

export default function Home() {
  const [status, setStatus] = useState("起動中…");
  const [userId, setUserId] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          setStatus("LIFF ID 未設定");
          return;
        }

        if (!window.liff) {
          setStatus("LIFF SDK読み込み失敗");
          return;
        }

        setStatus("LIFF初期化中…");
        await window.liff.init({ liffId });

        if (!window.liff.isLoggedIn()) {
          setStatus("LINEログインへ遷移します…");
          window.liff.login();
          return;
        }

        setStatus("プロフィール取得中…");
        const profile = await window.liff.getProfile();

        setUserId(profile.userId);
        setDisplayName(profile.displayName);

        // 🔥 ここからAPI経由で登録
        setStatus("ユーザー登録中(API)…");

        const res = await fetch("/api/upsert-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            line_user_id: profile.userId,
            display_name: profile.displayName,
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json.ok) {
          setStatus("🔥API経由エラー🔥: " + (json.error ?? res.statusText));
          return;
        }

        setStatus("OK：LIFFログイン＆users登録できました ✅");
      } catch (e: any) {
        setStatus("例外: " + (e?.message ?? String(e)));
      }
    })();
  }, []);

  return (
    <main style={{ padding: 20 }}>
      <h1>LIFF 接続テスト</h1>
      <p>{status}</p>

      {userId && (
        <div style={{ marginTop: 12 }}>
          <div>userId: {userId}</div>
          <div>displayName: {displayName}</div>
        </div>
      )}
    </main>
  );
}

