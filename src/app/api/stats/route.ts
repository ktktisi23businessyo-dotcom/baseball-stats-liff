import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey);
}

// ✅ 保存（upsert）
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const game_id = String(body.game_id ?? "");
    const line_user_id = String(body.line_user_id ?? "");
    const ab = Number(body.ab ?? 0);
    const h = Number(body.h ?? 0);
    const outs = Number(body.outs ?? 0);
    const er = Number(body.er ?? 0);

    if (!game_id || !line_user_id) {
      return NextResponse.json({ ok: false, error: "game_id と line_user_id は必須です" }, { status: 400 });
    }
    if ([ab, h, outs, er].some((n) => Number.isNaN(n) || n < 0)) {
      return NextResponse.json({ ok: false, error: "数値は0以上で入力してください" }, { status: 400 });
    }
    if (h > ab) {
      return NextResponse.json({ ok: false, error: "H は AB を超えられません" }, { status: 400 });
    }

    const supabase = getSupabase();

    // ✅ display_name が無い/空なら line_user_id を入れて NULL を避ける
    const displayName =
      typeof body.display_name === "string" && body.display_name.trim() !== ""
        ? body.display_name.trim()
        : line_user_id;

    // users（LINEユーザーを確保）
    const { data: users, error: userErr } = await supabase
      .from("users")
      .upsert({ line_user_id, display_name: displayName }, { onConflict: "line_user_id" })
      .select("id")
      .limit(1);

    if (userErr) {
      return NextResponse.json({ ok: false, error: userErr.message }, { status: 500 });
    }

    const user_id = users?.[0]?.id;
    if (!user_id) {
      return NextResponse.json({ ok: false, error: "user_id取得失敗" }, { status: 500 });
    }

    // stats（同一ユーザー×同一試合は更新）
    const { error: statsErr } = await supabase
      .from("stats")
      .upsert({ user_id, game_id, ab, h, outs, er }, { onConflict: "user_id,game_id" });

    if (statsErr) {
      return NextResponse.json({ ok: false, error: statsErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

// ✅ 読み込み
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const game_id = String(searchParams.get("game_id") ?? "");
    const line_user_id = String(searchParams.get("line_user_id") ?? "");

    if (!game_id || !line_user_id) {
      return NextResponse.json({ ok: false, error: "game_id と line_user_id は必須です" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: users, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("line_user_id", line_user_id)
      .limit(1);

    if (userErr) {
      return NextResponse.json({ ok: false, error: userErr.message }, { status: 500 });
    }

    const user_id = users?.[0]?.id;
    if (!user_id) {
      return NextResponse.json({ ok: true, stats: null });
    }

    const { data, error } = await supabase
      .from("stats")
      .select("ab,h,outs,er")
      .eq("user_id", user_id)
      .eq("game_id", game_id)
      .limit(1);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, stats: data?.[0] ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
