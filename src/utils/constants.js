export const PLATFORM_ADMIN_EMAILS = ["tom@axiolo.com", "gabriel@axiolo.com"];

export const WEEKS = [1, 2, 3];

export const ROLE_CONFIG = {
  admin: { label: "Admin", color: "#16a34a", bg: "#dcfce7" },
  captain: { label: "Captain", color: "#1e40af", bg: "#dbeafe" },
  vice_captain: { label: "Vice Captain", color: "#f59e0b", bg: "#fef3c7" },
};

export const STATUS_CONFIG = {
  not_contacted: { label: "Not Contacted", short: "NC", color: "#94a3b8", bg: "#f1f5f9" },
  contacted: { label: "Contacted", short: "CTD", color: "#f59e0b", bg: "#fef3c7" },
  confirmed: { label: "Available", short: "Yes", color: "#16a34a", bg: "#dcfce7" },
  declined: { label: "Declined", short: "No", color: "#dc2626", bg: "#fee2e2" },
  maybe: { label: "Maybe", short: "?", color: "#8b5cf6", bg: "#ede9fe" },
};

export const AVAIL_COLORS = { yes: "#16a34a", no: "#dc2626", maybe: "#8b5cf6" };

export const ACCENT = "#7dd3fc";

export const TEAM_COLORS = [
  { label: "TEAM 1", color: "#16a34a", bg: "#dcfce7" },
  { label: "TEAM 2", color: "#1e40af", bg: "#dbeafe" },
  { label: "TEAM 3", color: "#9333ea", bg: "#f3e8ff" },
  { label: "TEAM 4", color: "#ea580c", bg: "#fff7ed" },
  { label: "TEAM 5", color: "#0891b2", bg: "#ecfeff" },
  { label: "TEAM 6", color: "#be123c", bg: "#fff1f2" },
];

export const EMPTY_TEAM = () => ({
  opponent: "",
  teamNum: "#1",
  homeTee: "",
  awayTee: "",
  homeInterval: 10,
  awayInterval: 10,
});

export const DEFAULT_SCHEDULE = {
  1: { date: "", teamCount: 2, teams: [EMPTY_TEAM(), EMPTY_TEAM()] },
  2: { date: "", teamCount: 2, teams: [EMPTY_TEAM(), EMPTY_TEAM()] },
  3: { date: "", teamCount: 2, teams: [EMPTY_TEAM(), EMPTY_TEAM()] },
};

export const DEFAULT_LOCK_STATE = {
  1: { locked: false, lockedAt: null, lockedBy: null, modifiedAfterLock: false, lastSentAt: null },
  2: { locked: false, lockedAt: null, lockedBy: null, modifiedAfterLock: false, lastSentAt: null },
  3: { locked: false, lockedAt: null, lockedBy: null, modifiedAfterLock: false, lastSentAt: null },
};

export function isPlatformAdminEmail(email) {
  return PLATFORM_ADMIN_EMAILS.includes((email || "").toLowerCase().trim());
}
