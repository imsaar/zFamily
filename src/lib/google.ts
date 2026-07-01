import { google } from "googleapis";
import { db } from "./db";
import { upsertEvent, deleteEvent } from "./events";
import type { Member } from "./types";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

function clientForMember(member: Member | null) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.ZFAMILY_BASE_URL || process.env.SMARTCAL_BASE_URL || "http://localhost:3000";
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID/SECRET not configured");
  }
  const oauth = new google.auth.OAuth2(clientId, clientSecret, `${baseUrl}/api/auth/google/callback`);
  if (member && member.google_sub) {
    const row = db()
      .prepare(
        "SELECT google_access_token, google_refresh_token, google_token_expiry FROM members WHERE id = ?"
      )
      .get(member.id) as
      | { google_access_token: string | null; google_refresh_token: string | null; google_token_expiry: number | null }
      | undefined;
    if (row) {
      oauth.setCredentials({
        access_token: row.google_access_token ?? undefined,
        refresh_token: row.google_refresh_token ?? undefined,
        expiry_date: row.google_token_expiry ?? undefined,
      });
    }
  }
  return oauth;
}

export function makeAuthUrl(memberId: number): string {
  const oauth = clientForMember(null);
  const state = Buffer.from(JSON.stringify({ memberId })).toString("base64url");
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function handleCallback(code: string, state: string) {
  const { memberId } = JSON.parse(Buffer.from(state, "base64url").toString());
  const oauth = clientForMember(null);
  const { tokens } = await oauth.getToken(code);
  oauth.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth });
  const profile = await oauth2.userinfo.get();
  db()
    .prepare(
      `UPDATE members SET
        google_sub = ?,
        google_access_token = ?,
        google_refresh_token = COALESCE(?, google_refresh_token),
        google_token_expiry = ?,
        google_calendar_id = 'primary'
      WHERE id = ?`
    )
    .run(
      profile.data.id ?? null,
      tokens.access_token ?? null,
      tokens.refresh_token ?? null,
      tokens.expiry_date ?? null,
      memberId
    );
  return { memberId };
}

export async function syncMember(member: Member): Promise<{ updated: number; deleted: number }> {
  if (!member.google_calendar_id) return { updated: 0, deleted: 0 };
  const oauth = clientForMember(member);
  const cal = google.calendar({ version: "v3", auth: oauth });

  const row = db()
    .prepare("SELECT google_sync_token FROM members WHERE id = ?")
    .get(member.id) as { google_sync_token: string | null } | undefined;

  let syncToken: string | undefined = row?.google_sync_token ?? undefined;
  let updated = 0;
  let deleted = 0;
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  try {
    do {
      const res = await cal.events.list({
        calendarId: member.google_calendar_id,
        syncToken,
        pageToken,
        maxResults: 250,
        singleEvents: true,
        showDeleted: true,
        ...(syncToken
          ? {}
          : {
              timeMin: new Date(Date.now() - 7 * 86400_000).toISOString(),
              timeMax: new Date(Date.now() + 90 * 86400_000).toISOString(),
            }),
      });

      for (const item of res.data.items ?? []) {
        if (!item.id) continue;
        if (item.status === "cancelled") {
          deleteEvent(item.id);
          deleted++;
          continue;
        }
        const startDt = item.start?.dateTime ?? item.start?.date;
        const endDt = item.end?.dateTime ?? item.end?.date;
        if (!startDt || !endDt) continue;
        const allDay = !item.start?.dateTime;
        upsertEvent({
          id: item.id,
          member_id: member.id,
          calendar_id: member.google_calendar_id,
          title: item.summary ?? "(no title)",
          start_ts: Math.floor(new Date(startDt).getTime() / 1000),
          end_ts: Math.floor(new Date(endDt).getTime() / 1000),
          all_day: allDay ? 1 : 0,
          location: item.location ?? null,
          notes: item.description ?? null,
          rrule: item.recurrence?.[0] ?? null,
          etag: item.etag ?? null,
          source: "google",
        });
        updated++;
      }

      pageToken = res.data.nextPageToken ?? undefined;
      if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;
    } while (pageToken);

    if (nextSyncToken) {
      db().prepare("UPDATE members SET google_sync_token = ? WHERE id = ?").run(nextSyncToken, member.id);
    }
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 410) {
      // Sync token invalid — clear and full resync next time
      db().prepare("UPDATE members SET google_sync_token = NULL WHERE id = ?").run(member.id);
    } else {
      throw err;
    }
  }

  return { updated, deleted };
}

export async function syncAllMembers(): Promise<{ totalUpdated: number; totalDeleted: number }> {
  const members = db()
    .prepare("SELECT * FROM members WHERE google_calendar_id IS NOT NULL")
    .all() as Member[];
  let totalUpdated = 0;
  let totalDeleted = 0;
  for (const m of members) {
    try {
      const r = await syncMember(m);
      totalUpdated += r.updated;
      totalDeleted += r.deleted;
    } catch (err) {
      console.error(`[sync] Failed for ${m.name}:`, err);
    }
  }
  return { totalUpdated, totalDeleted };
}
