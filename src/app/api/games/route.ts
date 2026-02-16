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

    // 2) stats（試合に入力した user_id を拾う）
    const { data: stats, error: statsErr } = await supabase
      .from("stats")
      .select("game_id, user_id")
      .in("game_id", gameIds);

    if (statsErr) {
      return NextResponse.json({ ok: false, error: statsErr.message }, { status: 500 });
    }

    // user_id 一覧（重複排除）
    const userIds = Array.from(
      new Set((stats ?? []).map((s: any) => s.user_id).filter(Boolean))
    );

    // 3) users（display_name を user_id で引く）
    const userNameById: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: users, error: usersErr } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", userIds);

      if (usersErr) {
        return NextResponse.json({ ok: false, error: usersErr.message }, { status: 500 });
      }

      for (const u of users ?? []) {
        userNameById[String((u as any).id)] = String((u as any).display_name ?? "（名前未設定）");
      }
    }

    // 4) game_id => submitted_names を作る
    const submittedNamesByGameId: Record<string, string[]> = {};
    for (const row of stats ?? []) {
      const gid = String((row as any).game_id);
      const uid = String((row as any).user_id);
      const name = userNameById[uid] ?? "（名前未設定）";

      if (!submittedNamesByGameId[gid]) submittedNamesByGameId[gid] = [];
      submittedNamesByGameId[gid].push(name);
    }

    // 重複削除
    for (const gid of Object.keys(submittedNamesByGameId)) {
      submittedNamesByGameId[gid] = Array.from(new Set(submittedNamesByGameId[gid]));
    }

    // 5) gamesに付与して返す
    const enriched = (games ?? []).map((g: any) => ({
      ...g,
      submitted_names: submittedNamesByGameId[String(g.id)] ?? [],
    }));

    return NextResponse.json({ ok: true, games: enriched });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
