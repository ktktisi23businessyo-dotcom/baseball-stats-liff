"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Liff = {
  init: (arg: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: () => void;
  getProfile: () => Promise<{ userId: string; displayName: string }>;
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

        // 開発モード（LINE外）
        if (!window.liff.isInClient()) {
          setLineUserId("DEV_USER");
          setDisplayName("Dev User");

          // 既存データ確認
          const res = await fetch(
            `/api/stats?game_id=${encodeURIComponent(
              gameId
            )}&line_user_id=DEV_USER`
          );
          const json = await res.json().catch(() => ({}));

          if (res.ok && json.ok && json.stats) {
            setAb(Number(json.stats.ab ?? 0));
            setH(Number(json.stats.h ?? 0));
            setOuts(Number(json.stats.outs ?? 0));
            setEr(Number(json.stats.er ?? 0));
            setStatus("前回入力を読み込みました（開発モード）");
          } else {
            setStatus("開発モード：入力してください");
          }

          return;
        }

        await window.liff.init({ liffId });

        if (!window.liff.isLoggedIn()) {
          window.liff.login();
          return;
        }

        const profile = await window.liff.getProfile();
        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);

        // 🔥 ここが追加：既存成績読み込み
        setStatus("入力済みデータ確認中…");
        const res = await fetch(
          `/api/stats?game_id=${encodeURIComponent(
            gameId
          )}&line_user_id=${encodeURIComponent(profile.userId)}`
        );
        const json = await res.json().catch(() => ({}));

        if (res.ok && json.ok && json.stats) {
          setAb(Number(json.stats.ab ?? 0));
          setH(Number(json.stats.h ?? 0));
          setOuts(Number(json.stats.outs ?? 0));
          setEr(Number(json.stats.er ?? 0));
          setStatus("前回入力を読み込みました");
        } else {
          setStatus("入力してください");
        }
      } catch (e: any) {
        setStatus("例外: " + (e?.message ?? String(e)));
      }
    })();
  }, [gameId]);

  const onSave = async () => {
    try {
      if (!lineUserId) {
        setStatus("userIdが取得できていません");
        return;
      }
      if (h > ab) {
        setStatus("入力エラー：H は AB を超えられません");
        return;
      }

      setSaving(true);
      setStatus("保存中…");

      const res = await fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: gameId,
          line_user_id: lineUserId,
          display_name: displayName,
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
        {saving ? "保存中…" : "保存する"}
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
