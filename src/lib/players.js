import { supabase } from "./supabase";
import { parseNum } from "../utils/format";

export function dbPlayerToApp(p) {
  return {
    id: p.id, name: p.name, ghin: p.ghin || "", courseHdcp: parseNum(p.course_hdcp),
    index: parseNum(p.index), phone: p.phone || "", email: p.email || "",
    memberNumber: p.member_number || "",
    status: p.status || "not_contacted", contactOwner: p.contact_owner || "",
    contactDate: p.contact_date || "",
    availability: { 1: p.availability_1 || "no", 2: p.availability_2 || "no", 3: p.availability_3 || "no" },
    locPref: { 1: p.loc_pref_1 || "", 2: p.loc_pref_2 || "", 3: p.loc_pref_3 || "" },
    notes: p.notes || "",
  };
}

export function appPlayerToDb(p, club, userId) {
  return {
    club: club, name: p.name, ghin: p.ghin, course_hdcp: p.courseHdcp, index: p.index,
    phone: p.phone, email: p.email, member_number: p.memberNumber || "",
    status: p.status, contact_owner: p.contactOwner,
    contact_date: p.contactDate, availability_1: p.availability[1], availability_2: p.availability[2],
    availability_3: p.availability[3], loc_pref_1: p.locPref[1], loc_pref_2: p.locPref[2],
    loc_pref_3: p.locPref[3], notes: p.notes, created_by: userId,
  };
}

export async function loadPlayersFromDb(club) {
  const { data, error } = await supabase.from("players").select("*").eq("club", club).order("course_hdcp");
  if (error) { console.error("Load players error:", error); return []; }
  return (data || []).map(dbPlayerToApp);
}

export async function savePlayerToDb(player, club, userId) {
  const row = appPlayerToDb(player, club, userId);
  if (player.id && typeof player.id === "number" && player.id > 0) {
    const { data: existing } = await supabase.from("players").select("id").eq("id", player.id).single();
    if (existing) {
      const { error } = await supabase.from("players").update(row).eq("id", player.id);
      if (error) console.error("Update player error:", error);
      return player.id;
    }
  }
  delete row.id;
  const { data, error } = await supabase.from("players").insert(row).select("id").single();
  if (error) { console.error("Insert player error:", error); return null; }
  return data?.id;
}

export async function deletePlayerFromDb(playerId) {
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) console.error("Delete player error:", error);
}

export async function bulkInsertPlayers(players, club, userId) {
  const rows = players.map(p => {
    const row = appPlayerToDb(p, club, userId);
    delete row.id;
    return row;
  });
  const { data, error } = await supabase.from("players").insert(rows).select("id");
  if (error) { console.error("Bulk insert error:", error); return []; }
  return data || [];
}

export async function bulkUpsertPlayers(players, club, userId, options = {}) {
  const { data: existing } = await supabase.from("players").select("id, ghin, name").eq("club", club);
  const existingList = existing || [];
  const updates = [];
  const inserts = [];
  for (const p of players) {
    const row = appPlayerToDb(p, club, userId);
    delete row.id;
    const match = p.ghin
      ? existingList.find(e => e.ghin && String(e.ghin) === String(p.ghin))
      : existingList.find(e => e.name && e.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    if (match) {
      updates.push({ id: match.id, ...row });
    } else {
      inserts.push(row);
    }
  }
  for (const u of updates) {
    const { id, ...allFields } = u;
    const presentFields = options.presentDbFields;
    const fields = presentFields
      ? Object.fromEntries(Object.entries(allFields).filter(([k]) => presentFields.has(k)))
      : allFields;
    await supabase.from("players").update(fields).eq("id", id);
  }
  if (inserts.length > 0 && !options.updateOnly) {
    await supabase.from("players").insert(inserts);
  }
  return { updated: updates.length, inserted: options.updateOnly ? 0 : inserts.length };
}
