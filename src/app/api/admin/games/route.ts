import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey);
}

async function requireAdmin(lineUserId: string) {
  if (!lineUserId) throw new Error("x-line-user-id がありません");

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id,is_admin")
    .eq("line_user_id", lineUserId)
    .limit(1);

  if (error) throw new Error(error.message);

  const u = data?.[0];
  if (!u) throw new Error("ユーザー未登録です（先に成績入力でユーザー登録してください）");
  if (!u.is_admin) throw new Error("管理者権限がありません");
}

export async function GET(req: Request) {
  try {
    const lineUserId = req.headers.get("x-line-user-id") ?? "";
    await requireAdmin(lineUserId);

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("games")
      .select("id, game_date, opponent, memo")
      .order("game_date", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, games: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const lineUserId = req.headers.get("x-line-user-id") ?? "";
    await requireAdmin(lineUserId);

    const body = await req.json().catch(() => ({}));
    const game_date = String(body.game_date ?? "").trim();
    const opponent = body.opponent === null ? null : String(body.opponent ?? "").trim() || null;
    const memo = body.memo === null ? null : String(body.memo ?? "").trim() || null;

    if (!game_date) {
      return NextResponse.json({ ok: false, error: "game_date は必須です" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("games").insert({ game_date, opponent, memo });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 403 });
  }
}
