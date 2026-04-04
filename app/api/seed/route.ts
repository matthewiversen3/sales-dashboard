import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/seed";

export async function POST() {
  try {
    await seedDemoData();
    return NextResponse.json({ success: true, message: "Demo data seeded" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}
