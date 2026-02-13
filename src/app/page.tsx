"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
          setStatus("NEXT_PUBLIC_LIFF_ID が未設定です");
          return;
        }
        if (!window.liff) {
          setStatus("LIFF SDKの読み込みに失敗しました");
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

        setStatus("ユーザー登録中…");
        const { error } = await supabase.from("users").upsert(
          {
            line_user_id: profile.userId,
            display_name: profile.displayName,
          },
          { onConflict: "line_user_id" }
        );

        if (error) {
          setStatus("DBエラー: " + error.message);
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

