import { NextRequest, NextResponse } from "next/server";

interface TldvMeeting {
  id: string;
  title: string;
  created_at: string;
  duration: number;
  participants: { name: string; email?: string }[];
  summary?: string;
  transcript_url?: string;
}

interface TldvResponse {
  results: TldvMeeting[];
  next?: string;
}

const TLDV_API_BASE = "https://pasta.tldv.io/v1alpha1";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, since } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 400 });
    }

    // Fetch meetings from tl;dv
    const params = new URLSearchParams({ limit: "50" });
    if (since) {
      params.set("created_after", since);
    }

    const res = await fetch(`${TLDV_API_BASE}/meetings?${params}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      if (res.status === 401) {
        return NextResponse.json({ error: "Invalid API key. Check your tl;dv API key in Settings." }, { status: 401 });
      }
      return NextResponse.json({ error: `tl;dv API error: ${res.status} ${errorText}` }, { status: res.status });
    }

    const data: TldvResponse = await res.json();
    const meetings = data.results || [];

    // For each meeting, try to get the summary/transcript
    const enrichedMeetings = await Promise.all(
      meetings.map(async (meeting) => {
        let summary = meeting.summary || "";

        // Try to fetch meeting details for summary
        if (!summary) {
          try {
            const detailRes = await fetch(`${TLDV_API_BASE}/meetings/${meeting.id}`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (detailRes.ok) {
              const detail = await detailRes.json();
              summary = detail.summary || detail.ai_summary || "";
            }
          } catch {
            // Skip if detail fetch fails
          }
        }

        return {
          id: meeting.id,
          title: meeting.title || "Untitled Meeting",
          date: meeting.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
          duration: Math.round((meeting.duration || 0) / 60),
          participants: meeting.participants?.map((p) => p.name) || [],
          summary,
          url: `https://tldv.io/app/meetings/${meeting.id}`,
        };
      })
    );

    return NextResponse.json({
      meetings: enrichedMeetings,
      count: enrichedMeetings.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
