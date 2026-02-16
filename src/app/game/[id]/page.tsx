"use client";

import { useEffect, useState } from "react";

type LiffProfile = {
  userId: string;
  displayName: string;
};

type Liff = {
  init: (arg: { liffId: string }) => Promise<void>;
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

export default function TestPage() {
  const [status, setStatus] = useState("初期化中…");
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState("");
  const [inClient, setInClient] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!window.liff) {
          setStatus("LIFF SDK未読み込み");
          return;
        }

        await window.liff.init({
          liffId: process.env.NEXT_PUBLIC_LIFF_ID!,
        });

        await window.liff.ready;

        const client = window.liff.isInClient();
        setInClient(client);

        if (!window.liff.isLoggedIn()) {
          window.liff.login({
            redirectUri: window.location.href,
          });
          return;
        }

        const profile = await window.liff.getProfile();
        setDisplayName(profile.displayName);
        setUserId(profile.userId);

        setStatus("成功");
      } catch (e: any) {
        setStatus("エラー: " + (e?.message ?? String(e)));
      }
    })();
  }, []);

  return (
    <main style={{ padding: 20 }}>
      <h1>LIFF 最小テスト</h1>

      <p>状態: {status}</p>
      <p>inClient: {String(inClient)}</p>

      <hr />

      <p>表示名: {displayName}</p>
      <p>userId: {userId}</p>
    </main>
  );
}
