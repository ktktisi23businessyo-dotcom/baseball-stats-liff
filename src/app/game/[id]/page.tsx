"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const gameId = params.id;

  const [status, setStatus] = useState("起動中…");
  const [inClient, setInClient] = useState<boolean>(false);
  const [lineUserId, setLineUserId] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");

  const [ab, setAb] = useState<number>(0);
  const [h, setH] = useState<number>(0);
  const [outs, setOuts] = useState<number>(0);
  const [er, setEr] = useState<number>(0);

  const [saving, setSaving] = useState(false);

  // 既存成績ロード
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

  // getProfile を少し待ってリトライ（LIFFのclient featuresロード待ち対策）
  const getProfileWithRetry = async (tries = 3): Promise<LiffProfile> => {
    let lastErr: any = null;
    for (let i = 0; i < tries; i++) {
      try {
        return await window.liff.getProfile();
      } catch (e: any) {
        lastErr = e;
        await sleep(250 * (i + 1));
      }
    }
    throw lastErr;
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
          setStatus("LIFF SDK読み込み失敗（layout.tsx の script を確認）");
          return;
        }

        setStatus("LIFF初期化中…");
        await window.liff.init({
          liffId,
          // 外部ブラウザに飛ぶ環境でもログインを成立させる保険
          withLoginOnExternalBrowser: true,
        });

        // ✅ ここが重要：client features が揃うまで待つ
        await window.liff.ready;

        // ✅ isInClient は init/ready 後に評価（先に呼ぶと不安定になることがある）
        const _inClient = window.liff.isInClient();
        setInClient(_inClient);

        // ログインしてなければ / に戻してから復帰（戻り先を固定して安定化）
        if (!window.liff.isLoggedIn()) {
          setStatus("LINEログインへ遷移します…");
          const redirectUri =
            `${window.location.origin}/?redirect=${encodeURIComponent(`/game/${gameId}`)}`;
          window.liff.login({ redirectUri });
          return;
        }

        setStatus("プロフィール取得中…");
        const profile = await getProfileWithRetry(3);
        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);

        setStatus("入力済みデータ確認中…");
        const loaded = await loadExisting(gameId, profile.userId);
        setStatus(loaded ? "前回入力を読み込みました" : "入力してください");
      } catch (e: any) {
        // ここに「Unable to load client features.」が落ちてくる
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
      if (!lineUserId) {
        setStatus("ユーザー情報取得中です（少し待ってから再度保存）");
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

  const canSave = !saving && !!lineUserId;

  return (
    <main style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>成績入力</h1>
          <div style={{ color: "red", fontWeight: 900 }}>★ NEW BUILD CHECK ★</div>
        </div>

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
        onChange={(e) => {
          const v = e.target.value;
          const n = v === "" ? 0 : Number(v);
          onChange(Number.isFinite(n) ? n : 0);
        }}
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
