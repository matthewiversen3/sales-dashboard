import { sendSMS } from "@/lib/twilio";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { error: "Phone and message are required" },
        { status: 400 }
      );
    }

    try {
      const result = await sendSMS(phone, message);
      return NextResponse.json({ success: true, sid: result.sid });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "SMS send failed";

      // If Twilio isn't configured, return a helpful message
      if (errorMessage.includes("not configured")) {
        return NextResponse.json(
          {
            error: "Twilio not configured",
            hint: "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env.local",
          },
          { status: 503 }
        );
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
