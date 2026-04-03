import { NextRequest, NextResponse } from "next/server";

const GHL_API_BASE = "https://services.leadconnectorhq.com";

interface GHLContact {
  id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  source?: string;
  dateAdded?: string;
  customFields?: { id: string; value: string }[];
}

interface GHLContactsResponse {
  contacts: GHLContact[];
  meta?: { total: number; nextPageUrl?: string; startAfterId?: string; startAfter?: number };
}

// Map GHL tags to our lead sources
function tagToLeadSource(tags: string[]): string {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.some((t) => t.includes("meta") || t.includes("facebook") || t.includes("fb"))) return "Meta Ads";
  if (lower.some((t) => t.includes("referral") || t.includes("referred"))) return "Referral";
  if (lower.some((t) => t.includes("cold") || t.includes("outreach") || t.includes("outbound"))) return "Cold Outreach";
  if (lower.some((t) => t.includes("inbound") || t.includes("organic") || t.includes("website"))) return "Inbound";
  if (lower.some((t) => t.includes("ghl") || t.includes("highlevel"))) return "GHL";
  return "Other";
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, locationId, since } = await req.json();

    if (!apiKey || !locationId) {
      return NextResponse.json({ error: "API key and Location ID are required" }, { status: 400 });
    }

    // Fetch contacts from GHL
    const params = new URLSearchParams({
      locationId,
      limit: "100",
    });

    if (since) {
      // GHL uses startAfter timestamp
      params.set("startAfter", String(new Date(since).getTime()));
    }

    const res = await fetch(`${GHL_API_BASE}/contacts/?${params}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      if (res.status === 401) {
        return NextResponse.json(
          { error: "Invalid API key. Check your GHL Private Integration key." },
          { status: 401 }
        );
      }
      if (res.status === 422) {
        return NextResponse.json(
          { error: "Invalid Location ID. Go to GHL > Settings > Business Info to find your Location ID." },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: `GHL API error: ${res.status} ${errorText.slice(0, 200)}` },
        { status: res.status }
      );
    }

    const data: GHLContactsResponse = await res.json();
    const contacts = data.contacts || [];

    // Transform contacts to our format
    const transformedContacts = contacts.map((contact) => {
      const name = contact.contactName ||
        [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
        "Unknown Contact";

      return {
        id: contact.id,
        name,
        email: contact.email || "",
        phone: contact.phone || "",
        tags: contact.tags || [],
        leadSource: tagToLeadSource(contact.tags || []),
        source: contact.source || "",
        dateAdded: contact.dateAdded || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      contacts: transformedContacts,
      count: transformedContacts.length,
      total: data.meta?.total || transformedContacts.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GHL sync failed" },
      { status: 500 }
    );
  }
}
