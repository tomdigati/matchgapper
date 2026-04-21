import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./lib/supabase";
import {
  dbPlayerToApp, appPlayerToDb, loadPlayersFromDb, savePlayerToDb,
  deletePlayerFromDb, bulkInsertPlayers, bulkUpsertPlayers,
} from "./lib/players";
import {
  loadScheduleFromDb, saveScheduleWeekToDb,
  loadAssignmentsFromDb, saveAssignmentsWeekToDb,
} from "./lib/schedule";
import { parseCSVLine } from "./utils/csv";
import { parseName } from "./utils/names";
import { fmtH, fmtDate, fmtDateLong, addMinutes } from "./utils/format";
import {
  PLATFORM_ADMIN_EMAILS, WEEKS, ROLE_CONFIG, STATUS_CONFIG, AVAIL_COLORS,
  ACCENT, TEAM_COLORS, EMPTY_TEAM, DEFAULT_SCHEDULE, DEFAULT_LOCK_STATE,
  isPlatformAdminEmail,
} from "./utils/constants";
import LoginScreen from "./components/auth/LoginScreen";
import ClubRegistration from "./components/auth/ClubRegistration";
import InviteSignup from "./components/auth/InviteSignup";
import PlatformAdminSignup from "./components/auth/PlatformAdminSignup";
import OnboardingWizard from "./components/auth/OnboardingWizard";
import { GAP_CLUBS } from "./utils/data";
import SeasonSetup from "./components/setup/SeasonSetup";
import Dashboard from "./components/dashboard/Dashboard";
import Roster from "./components/roster/Roster";
import TeamBuilder from "./components/builder/TeamBuilder";
import AdminPanel from "./components/admin/AdminPanel";
import PlatformAdmin from "./components/platform/PlatformAdmin";

// Capture invite token immediately before any routing can strip it
const INITIAL_INVITE_TOKEN = new URLSearchParams(window.location.search).get("invite");

// ═══════════════════════════════════════════════════════════════
// AUTH HOOK
// ═══════════════════════════════════════════════════════════════
function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) { setLoading(true); fetchProfile(session.user.id); }
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      // Override platform admin flags in memory for authorized emails
      // (avoids RLS issues with self-referencing update policies)
      if (isPlatformAdminEmail(data.email)) {
        data.platform_admin = true;
        data.onboarded = true;
      }
      setProfile(data);
    }
    setLoading(false);
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(email, password, fullName, role, club) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: role, club: club } }
    });
    if (!error && data?.user) {
      const updates = { role: role, club: club };
      // Auto-set platform admin flags for authorized emails
      if (isPlatformAdminEmail(email)) {
        updates.platform_admin = true;
        updates.onboarded = true;
      }
      await supabase.from("profiles").update(updates).eq("id", data.user.id);
    }
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return { session, profile, loading, signIn, signUp, signOut, fetchProfile };
}

// Data layer imported from lib/players.js and lib/schedule.js
// Auth components imported from components/auth/
// GAP_CLUBS and SAMPLE_PLAYERS moved to utils/data.js
// ═══════════════════════════════════════════════════════════════
// SVG ICONS
// ═══════════════════════════════════════════════════════════════
const IconDashboard = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>);
const IconBuilder = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const IconRoster = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>);
const IconSetup = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
const IconAdmin = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
const IconLock = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
const IconUnlock = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>);

// ═══════════════════════════════════════════════════════════════
// EXCEL EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function exportRosterToExcel(players, type, clubName) {

  const filtered = type === "available"
    ? players.filter(p => [1, 2, 3].some(w => p.availability[w] === "yes"))
    : players;
  const rows = filtered.sort((a, b) => a.name.localeCompare(b.name)).map(p => {
    const { last, first } = parseName(p.name);
    return {
      "Last Name": last,
      "First Name": first,
      "GHIN": p.ghin,
      "Home Course HDCP": p.courseHdcp,
      "Player Low HI": p.index,
      "Member #": p.memberNumber || "",
      "Phone": p.phone,
      "Email": p.email,
      "Status": STATUS_CONFIG[p.status]?.label || p.status,
      "Wk1 Availability": p.availability[1],
      "Wk2 Availability": p.availability[2],
      "Wk3 Availability": p.availability[3],
      "Wk1 Loc Pref": p.locPref[1] || "",
      "Wk2 Loc Pref": p.locPref[2] || "",
      "Wk3 Loc Pref": p.locPref[3] || "",
      "Notes": p.notes,
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto column widths
  const colWidths = [{ wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 24 }];
  ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, "Roster");
  XLSX.writeFile(wb, `${clubName.replace(/[^a-z0-9]/gi, "_")}_${type === "available" ? "Available" : "Full_Roster"}.xlsx`);
}

function exportPairingsToExcel(activeWeek, assignments, players, schedule, clubName) {

  const ws = schedule[activeWeek];
  const w = assignments[activeWeek] || {};
  const rows = [];
  (ws.teams || []).forEach((ts, teamIdx) => {
    const tw = w[teamIdx];
    if (!tw) return;
    ["home", "away"].forEach(side => {
      const baseTee = side === "home" ? ts.homeTee : ts.awayTee;
      const interval = side === "home" ? (ts.homeInterval || 10) : (ts.awayInterval || 10);
      const loc = side === "home" ? clubName : ts.opponent;
      (tw[side] || []).forEach((pair, i) => {
        const p1 = players.find(p => p.id === pair[0]);
        const p2 = players.find(p => p.id === pair[1]);
        rows.push({
          "Team": `Team ${teamIdx + 1}`,
          "Opponent": `${ts.opponent} ${ts.teamNum || ""}`.trim(),
          "Side": side === "home" ? `Home (${clubName})` : `Away (${ts.opponent})`,
          "Pair #": i + 1,
          "Tee Time": addMinutes(baseTee, i * interval),
          "Location": loc,
          "Player 1": p1?.name || "TBD",
          "P1 Home Course HDCP": p1 ? fmtH(p1.courseHdcp) : "",
          "P1 GHIN": p1?.ghin || "",
          "P1 Member #": p1?.memberNumber || "",
          "Player 2": p2?.name || "TBD",
          "P2 Home Course HDCP": p2 ? fmtH(p2.courseHdcp) : "",
          "P2 GHIN": p2?.ghin || "",
          "P2 Member #": p2?.memberNumber || "",
        });
      });
    });
  });
  const wb = XLSX.utils.book_new();
  const wsSheet = XLSX.utils.json_to_sheet(rows);
  wsSheet["!cols"] = [{ wch: 10 }, { wch: 24 }, { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSheet, `Week ${activeWeek} Pairings`);
  XLSX.writeFile(wb, `${clubName.replace(/[^a-z0-9]/gi, "_")}_Week${activeWeek}_Pairings.xlsx`);
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function computeTeamSplit(players, week, teamCount = 2) {
  const confirmed = players.filter(p => p.availability[week] === "yes").sort((a, b) => a.courseHdcp - b.courseHdcp);
  const maybe = players.filter(p => p.availability[week] === "maybe").sort((a, b) => a.courseHdcp - b.courseHdcp);
  const teams = [];
  const thresholds = [];
  const maybeTeams = [];
  const ranges = [];
  const rangeCalc = (arr) => arr.length > 0 ? { min: Math.min(...arr.map(p => p.courseHdcp)), max: Math.max(...arr.map(p => p.courseHdcp)) } : null;

  for (let i = 0; i < teamCount; i++) {
    const team = confirmed.slice(i * 12, (i + 1) * 12);
    teams.push(team);
    ranges.push(rangeCalc(team));
  }
  for (let i = 0; i < teamCount - 1; i++) {
    thresholds.push(teams[i].length > 0 ? Math.max(...teams[i].map(p => p.courseHdcp)) : null);
  }
  for (let i = 0; i < teamCount; i++) {
    const lo = i === 0 ? -Infinity : (thresholds[i-1] ?? -Infinity);
    if (i === 0) {
      maybeTeams.push(maybe.filter(p => thresholds.length === 0 || thresholds[0] === null || p.courseHdcp <= thresholds[0]));
    } else if (i === teamCount - 1) {
      maybeTeams.push(maybe.filter(p => p.courseHdcp > lo));
    } else {
      const hi = thresholds[i] ?? Infinity;
      maybeTeams.push(maybe.filter(p => p.courseHdcp > lo && p.courseHdcp <= hi));
    }
  }
  // Backward-compatible aliases for 2-team case
  return { teams, thresholds, maybeTeams, ranges, confirmed, maybe,
    t1: teams[0] || [], t2: teams[1] || [],
    maybe1: maybeTeams[0] || [], maybe2: maybeTeams[1] || [],
    threshold: thresholds[0] ?? null,
    t1Range: ranges[0] || null, t2Range: ranges[1] || null,
  };
}

function projectTeam(player, thresholds) {
  // Support old single-value threshold for backward compat
  if (thresholds === null || thresholds === undefined) return 0;
  if (typeof thresholds === "number") return player.courseHdcp <= thresholds ? 0 : 1;
  if (!Array.isArray(thresholds) || thresholds.length === 0) return 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (thresholds[i] !== null && player.courseHdcp <= thresholds[i]) return i;
  }
  return thresholds.length;
}

const TAB_PATHS = {
  dashboard: "/dashboard", builder: "/team-builder", roster: "/roster",
  setup: "/season-setup", admin: "/admin", platform: "/platform",
};
const PATH_TO_TAB = Object.fromEntries(Object.entries(TAB_PATHS).map(([k, v]) => [v, k]));

function getTabFromPath() {
  const path = window.location.pathname;
  return PATH_TO_TAB[path] || "dashboard";
}

function GAPManager() {
  const { session, profile, loading, signIn, signUp, signOut, fetchProfile } = useAuth();
  const [activeTab, setActiveTabRaw] = useState(getTabFromPath);

  const setActiveTab = useCallback((tab) => {
    setActiveTabRaw(tab);
    const path = TAB_PATHS[tab] || "/dashboard";
    // Preserve query string (e.g. ?invite=TOKEN) when pushing state
    const search = window.location.search;
    if (window.location.pathname !== path) {
      window.history.pushState({ tab }, "", path + search);
    }
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = (e) => {
      const tab = e.state?.tab || getTabFromPath();
      setActiveTabRaw(tab);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const [players, setPlayers] = useState([]);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [lockState, setLockState] = useState(DEFAULT_LOCK_STATE);
  const emptyWeek = (teamCount) => { const w = {}; for (let i = 0; i < teamCount; i++) { w[i] = { home: [[], [], []], away: [[], [], []] }; } return w; };
  const [assignments, setAssignments] = useState(() => {
    const init = {}; [1, 2, 3].forEach(w => { init[w] = emptyWeek(DEFAULT_SCHEDULE[w]?.teamCount || 2); }); return init;
  });
  const [appScreen, setAppScreen] = useState("main"); // "main", "register_club", "platform_admin_signup"
  const [viewingClub, setViewingClub] = useState(() => sessionStorage.getItem("viewingClub") || null); // god mode: override club context
  const [inviteData, setInviteData] = useState(null); // holds validated invite info
  const [inviteLoading, setInviteLoading] = useState(false);

  // Check for invite token in URL on mount — use INITIAL_INVITE_TOKEN captured before routing
  useEffect(() => {
    const inviteToken = INITIAL_INVITE_TOKEN;
    if (inviteToken) {
      setInviteLoading(true);
      supabase.from("invitations").select("*").eq("token", inviteToken).single().then(({ data }) => {
        if (data && !data.used && new Date(data.expires_at) > new Date()) {
          setInviteData({ ...data, token: inviteToken });
        }
        setInviteLoading(false);
      });
    }
  }, []);

  // Derive role from profile — default to vice_captain for safety
  const isPlatformAdmin = !!profile?.platform_admin || isPlatformAdminEmail(profile?.email);
  const userRole = isPlatformAdmin ? "admin" : (profile?.role || "vice_captain");
  const isAdmin = userRole === "admin";
  const isCaptain = userRole === "captain" || isAdmin;
  const rc = ROLE_CONFIG[userRole] || ROLE_CONFIG.vice_captain;
  const clubName = profile?.club || "My Club";
  const clubInitial = clubName.charAt(0).toUpperCase();

  // Load players from Supabase when profile is ready
  // If in god mode (viewingClub set), load that club's players instead of profile.club
  useEffect(() => {
    const clubToLoad = viewingClub || (profile?.onboarded ? profile?.club : null);
    if (!clubToLoad) return;
    loadPlayersFromDb(clubToLoad).then(dbPlayers => {
      setPlayers(dbPlayers);
      setPlayersLoaded(true);
    });
  }, [profile?.club, profile?.onboarded, viewingClub]);

  // Load schedule & assignments from Supabase
  const scheduleLoadedRef = useRef(false);
  const assignmentsLoadedRef = useRef(false);

  useEffect(() => {
    const club = viewingClub || profile?.club;
    if (!club || (!profile?.onboarded && !isPlatformAdmin)) return;
    scheduleLoadedRef.current = false;
    assignmentsLoadedRef.current = false;
    loadScheduleFromDb(club).then(({ schedule: dbSched, lockState: dbLocks }) => {
      if (dbSched) {
        // Merge with defaults for any missing weeks
        const merged = { ...DEFAULT_SCHEDULE };
        [1, 2, 3].forEach(w => { if (dbSched[w]) merged[w] = dbSched[w]; });
        setSchedule(merged);
      } else {
        setSchedule(JSON.parse(JSON.stringify(DEFAULT_SCHEDULE)));
      }
      const mergedLocks = { ...DEFAULT_LOCK_STATE };
      if (dbLocks) {
        [1, 2, 3].forEach(w => { if (dbLocks[w]) mergedLocks[w] = dbLocks[w]; });
      }
      setLockState(mergedLocks);
      // Small delay to let state settle before enabling auto-save
      setTimeout(() => { scheduleLoadedRef.current = true; }, 500);
    });
    loadAssignmentsFromDb(club).then(dbAsgn => {
      const merged = {};
      [1, 2, 3].forEach(w => {
        merged[w] = (dbAsgn && dbAsgn[w]) ? dbAsgn[w] : emptyWeek(DEFAULT_SCHEDULE[w]?.teamCount || 2);
      });
      setAssignments(merged);
      setTimeout(() => { assignmentsLoadedRef.current = true; }, 500);
    });
  }, [profile?.club, profile?.onboarded, viewingClub]);

  // Auto-save schedule (debounced)
  // Guard: only save after load is confirmed AND only if the schedule has actual content
  // (prevents blank DEFAULT_SCHEDULE from overwriting real data on hard-refresh race conditions)
  const saveScheduleTimer = useRef(null);
  useEffect(() => {
    if (!scheduleLoadedRef.current) return;
    const club = viewingClub || profile?.club;
    if (!club || (isPlatformAdmin && !viewingClub)) return;
    // Don't save if all weeks are completely empty (opponents all blank) — likely a race condition
    const hasAnyContent = [1, 2, 3].some(w =>
      schedule[w]?.date || schedule[w]?.teams?.some(t => t.opponent)
    );
    if (!hasAnyContent) return;
    clearTimeout(saveScheduleTimer.current);
    saveScheduleTimer.current = setTimeout(() => {
      [1, 2, 3].forEach(w => {
        saveScheduleWeekToDb(club, w, schedule[w], lockState[w], session?.user?.id);
      });
    }, 1200);
    return () => clearTimeout(saveScheduleTimer.current);
  }, [schedule, lockState]);

  // Auto-save assignments (debounced)
  const saveAssignmentsTimer = useRef(null);
  useEffect(() => {
    if (!assignmentsLoadedRef.current) return;
    const club = viewingClub || profile?.club;
    if (!club || isPlatformAdmin && !viewingClub) return;
    clearTimeout(saveAssignmentsTimer.current);
    saveAssignmentsTimer.current = setTimeout(() => {
      [1, 2, 3].forEach(w => {
        saveAssignmentsWeekToDb(club, w, assignments[w], session?.user?.id);
      });
    }, 1200);
    return () => clearTimeout(saveAssignmentsTimer.current);
  }, [assignments]);

  // Wrapper to save player changes to Supabase (O(n) using Map)
  const setPlayersWithSync = useCallback((updater) => {
    setPlayers(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const saveClub = viewingClub || clubName;
      const userId = session?.user?.id;
      // Build Map for O(1) lookups instead of O(n) find()
      const prevMap = new Map(prev.map(p => [p.id, p]));
      const nextIds = new Set(next.map(p => p.id));
      // Find changed players and sync to DB
      next.forEach(p => {
        const old = prevMap.get(p.id);
        if (!old || old !== p) {
          savePlayerToDb(p, saveClub, userId);
        }
      });
      // Find deleted players
      prev.forEach(p => {
        if (!nextIds.has(p.id)) {
          deletePlayerFromDb(p.id);
        }
      });
      return next;
    });
  }, [clubName, viewingClub, session?.user?.id]);

  // Handle new player add (needs to get DB id back)
  const addPlayerWithSync = useCallback(async (newPlayer) => {
    const row = appPlayerToDb(newPlayer, effectiveClubName, session?.user?.id);
    delete row.id;
    const { data, error } = await supabase.from("players").insert(row).select("*").single();
    if (data) {
      setPlayers(prev => [...prev, dbPlayerToApp(data)]);
      return data.id;
    }
    return null;
  }, [effectiveClubName, session?.user?.id]);

  // Must be declared before any conditional returns (React Rules of Hooks)
  const [clubHasPlayers, setClubHasPlayers] = useState(null);
  const [godModeExiting, setGodModeExiting] = useState(false);
  useEffect(() => {
    if (profile && !profile.onboarded && profile.club && !isPlatformAdminEmail(profile?.email)) {
      supabase.from("players").select("id", { count: "exact", head: true }).eq("club", profile.club)
        .then(({ count }) => {
          if (count > 0) {
            supabase.from("profiles").update({ onboarded: true }).eq("id", profile.id).then(() => {
              fetchProfile(session.user.id);
            });
            setClubHasPlayers(true);
          } else {
            setClubHasPlayers(false);
          }
        });
    }
  }, [profile?.id, profile?.onboarded]);

  if (loading) {
    return (
      <div style={{ fontFamily: "'Poppins', sans-serif", background: "#eef2f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #7dd3fc, #38bdf8)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 600, color: "#0f172a", marginBottom: 16 }}>M</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    if (inviteLoading) {
      return (
        <div style={{ fontFamily: "'Poppins', sans-serif", background: "#eef2f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#64748b" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #7dd3fc, #38bdf8)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 600, color: "#0f172a", marginBottom: 16 }}>M</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Validating invitation...</div>
          </div>
        </div>
      );
    }
    if (inviteData) {
      return <InviteSignup invite={inviteData} onSignUp={signUp} onBack={() => { setInviteData(null); window.history.replaceState({}, "", window.location.pathname); }} />;
    }
    if (appScreen === "register_club") {
      return <ClubRegistration onBack={() => setAppScreen("main")} />;
    }
    if (appScreen === "platform_admin_signup") {
      return <PlatformAdminSignup onSignUp={signUp} onBack={() => setAppScreen("main")} />;
    }
    return <LoginScreen onSignIn={signIn} onSignUp={signUp} onRegisterClub={() => setAppScreen("register_club")} onPlatformAdmin={() => setAppScreen("platform_admin_signup")} />;
  }

  // Platform admins skip onboarding — check both flag and email as fallback
  const isPlatformByEmail = isPlatformAdminEmail(profile?.email);

  if (profile && !profile.onboarded && !isPlatformAdmin && !isPlatformByEmail) {
    // Still checking, or club has players (auto-onboarding in progress)
    if (clubHasPlayers === null || clubHasPlayers === true) {
      return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "Poppins, sans-serif", color: "#64748b" }}>Loading...</div>;
    }
    return <OnboardingWizard profile={profile} session={session} onComplete={() => {
      fetchProfile(session.user.id);
    }} onSetTeamCount={(count) => {
      setSchedule(prev => {
        const next = { ...prev };
        [1, 2, 3].forEach(w => {
          const ws = next[w];
          const oldTeams = ws.teams || [];
          const teams = [];
          for (let i = 0; i < count; i++) { teams.push(oldTeams[i] || EMPTY_TEAM()); }
          next[w] = { ...ws, teamCount: count, teams };
        });
        return next;
      });
    }} />;
  }

  // Platform admins who aren't viewing a specific club see only the Platform tab
  // When viewing a club, they see all tabs + a "Back to Platform" button
  const isViewingClub = isPlatformAdmin && viewingClub;
  const effectiveClubName = viewingClub || clubName;
  const effectiveClubInitial = effectiveClubName.charAt(0).toUpperCase();

  const tabs = isPlatformAdmin && !viewingClub
    ? [{ id: "platform", label: "Platform Admin", Icon: IconPlatform }]
    : [
        { id: "dashboard", label: "Dashboard", Icon: IconDashboard },
        { id: "builder", label: "Team Builder", Icon: IconBuilder },
        { id: "roster", label: "Roster", Icon: IconRoster },
        { id: "setup", label: "Season Setup", Icon: IconSetup },
        ...(isCaptain || isPlatformAdmin ? [{ id: "admin", label: "Admin", Icon: IconAdmin }] : []),
        ...(isPlatformAdmin ? [{ id: "platform", label: "Platform", Icon: IconPlatform }] : []),
      ];

  // Force platform tab for platform admins not viewing a club
  const effectiveTab = (isPlatformAdmin && !viewingClub && !["platform"].includes(activeTab)) ? "platform" : activeTab;

  const handleEnterClub = (club) => {
    sessionStorage.setItem("viewingClub", club);
    setViewingClub(club);
    setActiveTab("dashboard");
    // Load that club's players
    loadPlayersFromDb(club).then(dbPlayers => {
      setPlayers(dbPlayers);
      setPlayersLoaded(true);
    });
  };

  const handleExitClub = () => {
    setGodModeExiting(true);
    // Small delay to let any in-flight saves complete before clearing state
    setTimeout(() => {
      sessionStorage.removeItem("viewingClub");
      setViewingClub(null);
      setActiveTab("platform");
      setPlayers([]);
      setPlayersLoaded(false);
      setGodModeExiting(false);
    }, 800);
  };

  const headerAccent = isPlatformAdmin && !viewingClub ? "#f59e0b" : "#7dd3fc";
  const headerBorder = isPlatformAdmin && !viewingClub ? "3px solid #f59e0b" : "3px solid #7dd3fc";

  return (
    <div style={{ fontFamily: "'Poppins', 'Segoe UI', -apple-system, sans-serif", background: "#eef2f7", minHeight: "100vh", color: "#0f172a" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* God mode banner when viewing a club */}
      {(isViewingClub || godModeExiting) && (
        <div style={{ background: "#f59e0b", color: "#0f172a", padding: "6px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
          <span>{godModeExiting ? "Saving changes..." : `GOD MODE — Viewing ${viewingClub} as Platform Admin`}</span>
          <button onClick={handleExitClub} disabled={godModeExiting}
            style={{ padding: "4px 16px", borderRadius: 6, border: "none", background: "#0f172a", color: "#f59e0b", fontWeight: 600, fontSize: 11, cursor: godModeExiting ? "default" : "pointer", opacity: godModeExiting ? 0.5 : 1 }}>
            {godModeExiting ? "Please wait..." : "Back to Platform"}
          </button>
        </div>
      )}

      <header className="mg-header" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "0 24px", borderBottom: headerBorder }}>
        <div className="mg-header-inner" style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="mg-branding" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="mg-logo" style={{ width: 42, height: 42, borderRadius: "50%", background: isPlatformAdmin && !viewingClub ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #7dd3fc, #38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 600, color: isPlatformAdmin && !viewingClub ? "#fff" : "#0f172a" }}>
              {isPlatformAdmin && !viewingClub ? "⚡" : effectiveClubInitial}
            </div>
            <div className="mg-branding-text">
              <div style={{ color: headerAccent, fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>
                {isPlatformAdmin && !viewingClub ? "MatchGapper" : effectiveClubName}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 11, letterSpacing: 1 }}>
                {isPlatformAdmin && !viewingClub ? "PLATFORM ADMINISTRATION" : "BMW GAP TEAM MATCHES 2026"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <nav className="mg-nav" style={{ display: "flex", gap: 2 }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "16px 20px", background: effectiveTab === t.id ? (headerAccent + "15") : "transparent", border: "none", borderBottom: effectiveTab === t.id ? `3px solid ${headerAccent}` : "3px solid transparent", color: effectiveTab === t.id ? headerAccent : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
                  <t.Icon /> {t.label}
                </button>
              ))}
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="mg-user-info" style={{ textAlign: "right" }}>
                <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>{profile?.full_name || session.user.email}</div>
                <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: isPlatformAdmin ? "#fef3c7" : rc.bg, color: isPlatformAdmin ? "#92400e" : rc.color, letterSpacing: 0.5 }}>
                  {isPlatformAdmin ? "PLATFORM ADMIN" : rc.label.toUpperCase()}
                </span>
              </div>
              <button className="mg-signout" onClick={signOut} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer" }} title="Sign out">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mg-main" style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        {effectiveTab === "dashboard" && <Dashboard players={players} schedule={schedule} lockState={lockState} clubName={effectiveClubName} assignments={assignments} />}
        {effectiveTab === "roster" && <Roster players={players} setPlayers={setPlayersWithSync} addPlayerWithSync={addPlayerWithSync} clubName={effectiveClubName} userId={session.user.id} schedule={schedule} />}
        {effectiveTab === "builder" && <TeamBuilder players={players} schedule={schedule} lockState={lockState} setLockState={setLockState} userRole={userRole} clubName={effectiveClubName} assignments={assignments} setAssignments={setAssignments} />}
        {effectiveTab === "setup" && <SeasonSetup schedule={schedule} setSchedule={setSchedule} lockState={lockState} userRole={userRole} clubName={effectiveClubName} />}
        {effectiveTab === "admin" && (isCaptain || isPlatformAdmin) && <AdminPanel currentUserId={session.user.id} clubName={effectiveClubName} />}
        {effectiveTab === "platform" && isPlatformAdmin && <PlatformAdmin currentUserId={session.user.id} onEnterClub={handleEnterClub} />}
      </main>
      <footer style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: 11, borderTop: "1px solid #d1d9e6" }}>MatchGapper · BMW GAP Team Match Manager · All matches scratch — no handicap strokes</footer>
    </div>
  );
}

export default GAPManager;
