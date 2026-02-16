import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey);
}

// ※ MVP簡易：ヘッダ等で誰かを識別せず「is_admin のユーザーが存在するか」だけで制限しない
// → 本番では必ずLINE userIdと紐づけた管理者判定にする（次ステップでやる）
async function assertAdmin() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("users").select("id").eq("is_admin", true).limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("管理者が設定されていません（users.is_admin を true にしてください）");
}

export async function GET() {
  try {
    await assertAdmin();
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
    await assertAdmin();
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
