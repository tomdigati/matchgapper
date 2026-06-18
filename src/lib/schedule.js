import { supabase } from "./supabase";

export async function loadScheduleFromDb(club) {
  const { data, error } = await supabase.from("season_schedule").select("*").eq("club", club);
  if (error) { console.error("Load schedule error:", error); return { schedule: null, lockState: null }; }
  if (!data || data.length === 0) return { schedule: null, lockState: null };
  const sched = {};
  const locks = {};
  data.forEach(row => {
    const teams = (row.teams || []).map(t => ({
      opponent: t.opponent || "", teamNum: t.teamNum || "#1",
      homeTee: t.homeTee || "", awayTee: t.awayTee || "",
      homeInterval: t.homeInterval || 10, awayInterval: t.awayInterval || 10,
    }));
    sched[row.week] = { date: row.match_date || "", teamCount: row.team_count || 2, teams };
    locks[row.week] = row.lock_state || { locked: false, lockedAt: null, lockedBy: null, modifiedAfterLock: false, lastSentAt: null };
  });
  return { schedule: sched, lockState: locks };
}

export async function saveScheduleWeekToDb(club, week, weekData, lockData, userId) {
  const row = {
    club, week: parseInt(week),
    match_date: weekData.date || null,
    team_count: weekData.teamCount || 2,
    teams: weekData.teams || [],
    lock_state: lockData || { locked: false, lockedAt: null, lockedBy: null, modifiedAfterLock: false, lastSentAt: null },
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("season_schedule").upsert(row, { onConflict: "club,week" });
  if (error) console.error("Save schedule week", week, "error:", error);
}

export async function loadAssignmentsFromDb(club) {
  const { data, error } = await supabase.from("team_assignments").select("*").eq("club", club);
  if (error) { console.error("Load assignments error:", error); return null; }
  if (!data || data.length === 0) return null;
  const asgn = {};
  data.forEach(row => { asgn[row.week] = row.assignments || {}; });
  return asgn;
}

export async function saveAssignmentsWeekToDb(club, week, weekAssignments, userId) {
  const row = {
    club, week: parseInt(week),
    assignments: weekAssignments || {},
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("team_assignments").upsert(row, { onConflict: "club,week" });
  if (error) console.error("Save assignments week", week, "error:", error);
}
