import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function GET() {
  try {
    const supabase = getSupabase();

    // 1) 試合一覧
    const { data: games, error: gamesErr } = await supabase
      .from("games")
      .select("id, game_date, opponent, memo")
      .order("game_date", { ascending: false });

    if (gamesErr) {
      return NextResponse.json({ ok: false, error: gamesErr.message }, { status: 500 });
    }

    const gameIds = (games ?? []).map((g: any) => g.id);
    if (gameIds.length === 0) {
      return NextResponse.json({ ok: true, games: [] });
    }

    // 2) stats + users(display_name) をJOINで取る（外部キーがある前提）
    const { data: stats, error: statsErr } = await supabase
      .from("stats")
      .select("game_id, users(display_name)")
      .in("game_id", gameIds);

    if (statsErr) {
      return NextResponse.json({ ok: false, error: statsErr.message }, { status: 500 });
    }

    // 3) game_id => submitted_names
    const submittedNamesByGameId: Record<string, string[]> = {};
    for (const row of stats ?? []) {
      const gid = String((row as any).game_id);
      const name = String((row as any).users?.display_name ?? "").trim() || "（名前未設定）";

      if (!submittedNamesByGameId[gid]) submittedNamesByGameId[gid] = [];
      submittedNamesByGameId[gid].push(name);
    }

    // 重複削除
    for (const gid of Object.keys(submittedNamesByGameId)) {
      submittedNamesByGameId[gid] = Array.from(new Set(submittedNamesByGameId[gid]));
    }

    // 4) gamesに付与
    const enriched = (games ?? []).map((g: any) => ({
      ...g,
      submitted_names: submittedNamesByGameId[String(g.id)] ?? [],
    }));

    return NextResponse.json({ ok: true, games: enriched });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
