import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { id, stage } = await req.json();
  if (!id || !stage) {
    return NextResponse.json({ error: "id and stage required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
