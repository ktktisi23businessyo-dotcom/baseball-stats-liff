"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type LiffProfile = { userId: string; displayName: string };

type Liff = {
  init: (arg: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: () => void;
  getProfile: () => Promise<LiffProfile>;
  isInClient: () => boolean;
};

declare global {
  interface Window {
    liff: Liff;
  }
}

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const gameId = params.id;

  const [status, setStatus] = useState("起動中…");
  const [lineUserId, setLineUserId] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");

  const [ab, setAb] = useState<number>(0);
  const [h, setH] = useState<number>(0);
  const [outs, setOuts] = useState<number>(0);
  const [er, setEr] = useState<number>(0);

  const [saving, setSaving] = useState(false);

  const inClient = useMemo(() => {
    try {
      return typeof window !== "undefined" && window.liff ? window.liff.isInClient() : false;
    } catch {
      return false;
    }
  }, []);

  const loadExisting = async (gid: string, luid: string) => {
    const res = await fetch(
      `/api/stats?game_id=${encodeURIComponent(gid)}&line_user_id=${encodeURIComponent(luid)}`
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.stats) {
      setAb(Number(json.stats.ab ?? 0));
      setH(Number(json.stats.h ?? 0));
      setOuts(Number(json.stats.outs ?? 0));
      setEr(Number(json.stats.er ?? 0));
      return true;
    }
    return false;
  };

  const ensureLineUser = async (): Promise<{ line_user_id: string; display_name: string } | null> => {
    // すでに持ってるならそれを使う
    if (lineUserId) return { line_user_id: lineUserId, display_name: displayName };

    // LIFFが無いなら無理
    if (!window.liff) return null;

    // LINE外（ローカルなど）ならDEVで通す
    if (!window.liff.isInClient()) {
      setLineUserId("DEV_USER");
      setDisplayName("Dev User");
      return { line_user_id: "DEV_USER", display_name: "Dev User" };
    }

    // LINE内：init済み前提だが、念のため再試行
    try {
      const profile = await window.liff.getProfile();
      setLineUserId(profile.userId);
      setDisplayName(profile.displayName);
      return { line_user_id: profile.userId, display_name: profile.displayName };
    } catch {
      return null;
    }
  };

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

        // LINE外：開発モード
        if (!window.liff.isInClient()) {
          setLineUserId("DEV_USER");
          setDisplayName("Dev User");
          const loaded = await loadExisting(gameId, "DEV_USER");
          setStatus(loaded ? "前回入力を読み込みました（開発モード）" : "開発モード：入力してください");
          return;
        }

        // LINE内
        setStatus("LIFF初期化中…");
        await window.liff.init({ liffId });

        // ※ LINE内でも環境によっては isLoggedIn が false になることがある
        if (!window.liff.isLoggedIn()) {
          setStatus("LINEログインへ遷移します…");
          window.liff.login();
          return;
        }

        setStatus("プロフィール取得中…");
        const profile = await window.liff.getProfile();
        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);

        setStatus("入力済みデータ確認中…");
        const loaded = await loadExisting(gameId, profile.userId);
        setStatus(loaded ? "前回入力を読み込みました" : "入力してください");
      } catch (e: any) {
        setStatus("例外: " + (e?.message ?? String(e)));
      }
    })();
  }, [gameId]);

  const onSave = async () => {
    try {
      if (h > ab) {
        setStatus("入力エラー：H は AB を超えられません");
        return;
      }

      setSaving(true);
      setStatus("保存準備中…");

      const user = await ensureLineUser();
      if (!user) {
        setStatus("userId取得に失敗（LINE内で開けているか確認してください）");
        return;
      }

      setStatus("保存中…");
      const res = await fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: gameId,
          line_user_id: user.line_user_id,
          display_name: user.display_name,
          ab,
          h,
          outs,
          er,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setStatus("保存エラー: " + (json.error ?? res.statusText));
        return;
      }

      setStatus("保存しました ✅");
    } catch (e: any) {
      setStatus("例外: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  const canSave = !saving && (inClient ? !!lineUserId : true);

  return (
    <main style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>成績入力</h1>
        <button
          onClick={() => router.push("/")}
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: "8px 10px",
            background: "white",
            fontWeight: 600,
          }}
        >
          ← 一覧へ
        </button>
      </div>

      <div>
        <div>game_id: {gameId}</div>
        <div>状態：{status}</div>
        <div style={{ fontSize: 12, color: "#666" }}>inClient: {String(inClient)}</div>

        {lineUserId && (
          <div style={{ fontSize: 12, color: "#666" }}>
            {displayName}（{lineUserId}）
          </div>
        )}
      </div>

      <NumberField label="AB（打数）" value={ab} onChange={setAb} />
      <NumberField label="H（安打）" value={h} onChange={setH} />
      <NumberField label="OUT（投球アウト数）" value={outs} onChange={setOuts} />
      <NumberField label="ER（自責点）" value={er} onChange={setEr} />

      <button
        onClick={onSave}
        disabled={!canSave}
        style={{
          borderRadius: 12,
          padding: "12px 14px",
          border: "1px solid #0a66c2",
          background: !canSave ? "#eee" : "#0a66c2",
          color: !canSave ? "#333" : "white",
          fontWeight: 800,
        }}
      >
        {saving ? "保存中…" : canSave ? "保存する" : "ユーザー情報取得中…"}
      </button>
    </main>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <input
        type="number"
        min={0}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: "12px",
          fontSize: 16,
        }}
      />
    </label>
  );
}
