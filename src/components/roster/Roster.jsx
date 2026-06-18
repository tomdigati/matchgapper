import { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { parseCSVLine } from "../../utils/csv";
import { parseName } from "../../utils/names";
import { fmtH, parseNum } from "../../utils/format";
import { STATUS_CONFIG, AVAIL_COLORS, TEAM_COLORS, ACCENT } from "../../utils/constants";
import { deletePlayerFromDb, bulkUpsertPlayers, loadPlayersFromDb } from "../../lib/players";

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
  return { teams, thresholds, maybeTeams, ranges, confirmed, maybe,
    t1: teams[0] || [], t2: teams[1] || [],
    maybe1: maybeTeams[0] || [], maybe2: maybeTeams[1] || [],
    threshold: thresholds[0] ?? null,
    t1Range: ranges[0] || null, t2Range: ranges[1] || null,
  };
}

function projectTeam(player, thresholds) {
  if (thresholds === null || thresholds === undefined) return 0;
  if (typeof thresholds === "number") return player.courseHdcp <= thresholds ? 0 : 1;
  if (!Array.isArray(thresholds) || thresholds.length === 0) return 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (thresholds[i] !== null && player.courseHdcp <= thresholds[i]) return i;
  }
  return thresholds.length;
}

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
          "Tee Time": fmtH(baseTee),
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
// ROSTER COMPONENT
// ═══════════════════════════════════════════════════════════════
function Roster({ players, setPlayers, addPlayerWithSync, clubName, userId, schedule }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterWk1, setFilterWk1] = useState("all");
  const [filterWk2, setFilterWk2] = useState("all");
  const [filterWk3, setFilterWk3] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [sortField, setSortField] = useState("courseHdcp");
  const [sortDir, setSortDir] = useState("asc");
  const [editingId, setEditingId] = useState(null);
  const overallTC = (schedule && schedule[1]) ? (schedule[1].teamCount || 2) : 2;
  const overallSplit = computeTeamSplit(players, 1, overallTC);
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };
  const sortArrow = (field) => sortField === field ? (sortDir === "asc" ? " ▲" : " ▼") : "";
  const filtered = useMemo(() => {
    let list = [...players];
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.ghin.includes(search));
    if (filterStatus !== "all") list = list.filter(p => p.status === filterStatus);
    if (filterWk1 !== "all") list = list.filter(p => p.availability[1] === filterWk1);
    if (filterWk2 !== "all") list = list.filter(p => p.availability[2] === filterWk2);
    if (filterWk3 !== "all") list = list.filter(p => p.availability[3] === filterWk3);
    if (filterTeam !== "all") {
      const ti = parseInt(filterTeam);
      list = list.filter(p => projectTeam(p, overallSplit.thresholds) === ti);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "courseHdcp") cmp = a.courseHdcp - b.courseHdcp;
      else if (sortField === "index") cmp = (a.index || 0) - (b.index || 0);
      else if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "ghin") cmp = a.ghin.localeCompare(b.ghin);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "wk1") cmp = (a.availability[1] || "").localeCompare(b.availability[1] || "");
      else if (sortField === "wk2") cmp = (a.availability[2] || "").localeCompare(b.availability[2] || "");
      else if (sortField === "wk3") cmp = (a.availability[3] || "").localeCompare(b.availability[3] || "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [players, search, filterStatus, filterWk1, filterWk2, filterWk3, filterTeam, sortField, sortDir, overallSplit.thresholds]);
  // Freeze sort order while editing to prevent row jumping
  const frozenOrderRef = useRef(null);
  useEffect(() => {
    if (editingId !== null && frozenOrderRef.current === null) {
      frozenOrderRef.current = filtered.map(p => p.id);
    } else if (editingId === null) {
      frozenOrderRef.current = null;
    }
  }, [editingId]);
  const displayRows = useMemo(() => {
    if (editingId !== null && frozenOrderRef.current) {
      return frozenOrderRef.current.map(id => filtered.find(p => p.id === id)).filter(Boolean);
    }
    return filtered;
  }, [filtered, editingId]);

  const [statusOpenId, setStatusOpenId] = useState(null);
  const [addPlayerModal, setAddPlayerModal] = useState(false);
  const BLANK_DRAFT = { lastName: "", firstName: "", courseHdcp: "", index: "", ghin: "", phone: "", email: "" };
  const [newPlayerDraft, setNewPlayerDraft] = useState(BLANK_DRAFT);
  const [addPlayerSaving, setAddPlayerSaving] = useState(false);
  const [addPlayerError, setAddPlayerError] = useState(null);

  const saveNewPlayer = async () => {
    if (!newPlayerDraft.lastName.trim()) { setAddPlayerError("Last name is required"); return; }
    setAddPlayerSaving(true);
    setAddPlayerError(null);
    const name = newPlayerDraft.firstName.trim()
      ? `${newPlayerDraft.lastName.trim()}, ${newPlayerDraft.firstName.trim()}`
      : newPlayerDraft.lastName.trim();
    const newPlayer = {
      name, ghin: newPlayerDraft.ghin, courseHdcp: parseNum(newPlayerDraft.courseHdcp),
      index: parseNum(newPlayerDraft.index || newPlayerDraft.courseHdcp),
      phone: newPlayerDraft.phone, email: newPlayerDraft.email, memberNumber: "",
      status: "not_contacted", contactOwner: "", contactDate: "",
      availability: { 1: "no", 2: "no", 3: "no" }, locPref: { 1: "", 2: "", 3: "" }, notes: "",
    };
    if (addPlayerWithSync) {
      const newId = await addPlayerWithSync(newPlayer);
      if (newId) setEditingId(newId);
    } else {
      const newId = Math.max(...players.map(p => p.id), 0) + 1;
      setPlayers(prev => [...prev, { ...newPlayer, id: newId }]);
      setEditingId(newId);
    }
    setAddPlayerSaving(false);
    setAddPlayerModal(false);
    setNewPlayerDraft(BLANK_DRAFT);
  };

  const updatePlayer = (id, field, value) => setPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  const updateAvail = (id, week, value) => setPlayers(prev => prev.map(p => p.id === id ? { ...p, availability: { ...p.availability, [week]: value } } : p));
  const updateLocPref = (id, week, value) => setPlayers(prev => prev.map(p => p.id === id ? { ...p, locPref: { ...p.locPref, [week]: value } } : p));

  const [uploadMsg, setUploadMsg] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) { setUploadMsg("File too large. Maximum size is 5MB."); return; }
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext)) { setUploadMsg("Invalid file type. Please upload a CSV or Excel file."); return; }
    try {
      let text = "";
      if (ext === "csv") {
        text = await file.text();
      } else if (ext === "xlsx" || ext === "xls") {
        if (!XLSX) { setUploadMsg("Excel library not loaded. Please refresh the page and try again."); return; }
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(ws);
      }
      if (!text) { setUploadMsg("Could not read file."); return; }
      const lines = text.trim().split("\n").map(l => parseCSVLine(l));
      if (lines.length < 2) { setUploadMsg("File appears empty."); return; }
      const header = lines[0].map(h => h.toLowerCase().trim());
      const firstNameIdx = header.findIndex(h => h === "first name" || h === "firstname" || h === "first");
      const lastNameIdx = header.findIndex(h => h === "last name" || h === "lastname" || h === "last");
      const nameIdx = header.findIndex(h => h === "name" || h === "player" || h === "player name");
      const hasSeparateNames = firstNameIdx > -1 && lastNameIdx > -1;
      const ghinIdx = header.findIndex(h => h.includes("ghin"));
      const hdcpIdx = header.findIndex(h => h.includes("hdcp") || h.includes("handicap") || h.includes("course"));
      const indexIdx = header.findIndex(h => h.includes("index") || h.includes("low hi") || h.includes("player low"));
      const phoneIdx = header.findIndex(h => h.includes("phone") || h.includes("cell") || h.includes("mobile"));
      const emailIdx = header.findIndex(h => h.includes("email") || h.includes("e-mail"));
      const memberNumberIdx = header.findIndex(h => h.includes("member"));
      const notesIdx = header.findIndex(h => h.includes("note"));
      const statusIdx = header.findIndex(h => h === "status");
      const wk1Idx = header.findIndex(h => (h.includes("wk1") || h.includes("wk 1") || h === "week 1") && h.includes("avail"));
      const wk2Idx = header.findIndex(h => (h.includes("wk2") || h.includes("wk 2") || h === "week 2") && h.includes("avail"));
      const wk3Idx = header.findIndex(h => (h.includes("wk3") || h.includes("wk 3") || h === "week 3") && h.includes("avail"));
      const lp1Idx = header.findIndex(h => (h.includes("wk1") || h.includes("wk 1")) && (h.includes("loc") || h.includes("pref")));
      const lp2Idx = header.findIndex(h => (h.includes("wk2") || h.includes("wk 2")) && (h.includes("loc") || h.includes("pref")));
      const lp3Idx = header.findIndex(h => (h.includes("wk3") || h.includes("wk 3")) && (h.includes("loc") || h.includes("pref")));
      const parseLocPref = (val) => { const v = (val || "").trim().toLowerCase(); return v === "home" ? "Home" : v === "away" ? "Away" : ""; };
      const hasLocPrefCols = lp1Idx > -1 || lp2Idx > -1 || lp3Idx > -1;
      const parseStatus = (val) => {
        const v = (val || "").toLowerCase().trim().replace(/\s+/g, "_");
        const map = { available: "confirmed", confirmed: "confirmed", contacted: "contacted", not_contacted: "not_contacted", "not contacted": "not_contacted", declined: "declined", maybe: "maybe" };
        return map[v] || map[(val || "").toLowerCase().trim()] || "not_contacted";
      };
      const parseAvail = (val) => { const v = (val || "").toLowerCase().trim(); return v === "yes" || v === "y" ? "yes" : v === "maybe" ? "maybe" : "no"; };
      if (!hasSeparateNames && nameIdx === -1) { setUploadMsg("Could not find name columns. Use 'First Name' and 'Last Name', or a single 'Name' column."); return; }
      const getName = (row) => {
        if (hasSeparateNames) {
          const first = (row[firstNameIdx] || "").trim();
          const last = (row[lastNameIdx] || "").trim();
          return last && first ? `${last}, ${first}` : last || first || "Unknown";
        }
        return (row[nameIdx] || "Unknown").trim();
      };
      const hasData = (row) => hasSeparateNames ? ((row[firstNameIdx] || "").trim() || (row[lastNameIdx] || "").trim()) : (row[nameIdx] || "").trim();
      const newPlayers = lines.slice(1).filter(row => hasData(row)).map((row, i) => ({
        name: getName(row),
        ghin: ghinIdx > -1 ? (row[ghinIdx] || "") : "",
        courseHdcp: parseNum(hdcpIdx > -1 ? row[hdcpIdx] : null),
        index: parseNum(indexIdx > -1 ? row[indexIdx] : (hdcpIdx > -1 ? row[hdcpIdx] : null)),
        phone: phoneIdx > -1 ? (row[phoneIdx] || "") : "",
        email: emailIdx > -1 ? (row[emailIdx] || "") : "",
        memberNumber: memberNumberIdx > -1 ? (row[memberNumberIdx] || "") : "",
        status: statusIdx > -1 ? parseStatus(row[statusIdx]) : "not_contacted",
        contactOwner: "", contactDate: "",
        availability: { 1: wk1Idx > -1 ? parseAvail(row[wk1Idx]) : "no", 2: wk2Idx > -1 ? parseAvail(row[wk2Idx]) : "no", 3: wk3Idx > -1 ? parseAvail(row[wk3Idx]) : "no" },
        locPref: { 1: lp1Idx > -1 ? parseLocPref(row[lp1Idx]) : "", 2: lp2Idx > -1 ? parseLocPref(row[lp2Idx]) : "", 3: lp3Idx > -1 ? parseLocPref(row[lp3Idx]) : "" }, notes: notesIdx > -1 ? (row[notesIdx] || "") : ""
      }));
      const presentDbFields = new Set(["name"]);
      if (ghinIdx > -1) presentDbFields.add("ghin");
      if (hdcpIdx > -1) presentDbFields.add("course_hdcp");
      if (indexIdx > -1) { presentDbFields.add("index"); } else if (hdcpIdx > -1) { presentDbFields.add("index"); }
      if (phoneIdx > -1) presentDbFields.add("phone");
      if (emailIdx > -1) presentDbFields.add("email");
      if (memberNumberIdx > -1) presentDbFields.add("member_number");
      if (notesIdx > -1) presentDbFields.add("notes");
      if (statusIdx > -1) presentDbFields.add("status");
      if (wk1Idx > -1) presentDbFields.add("availability_1");
      if (wk2Idx > -1) presentDbFields.add("availability_2");
      if (wk3Idx > -1) presentDbFields.add("availability_3");
      if (lp1Idx > -1) presentDbFields.add("loc_pref_1");
      if (lp2Idx > -1) presentDbFields.add("loc_pref_2");
      if (lp3Idx > -1) presentDbFields.add("loc_pref_3");
      if (clubName && userId) {
        const result = await bulkUpsertPlayers(newPlayers, clubName, userId, { hasLocPref: hasLocPrefCols, presentDbFields });
        const dbPlayers = await loadPlayersFromDb(clubName);
        setPlayers(prev => dbPlayers);
        setUploadMsg(`Updated ${result.updated} players, added ${result.inserted} new from ${file.name}`);
      } else {
        setPlayers(prev => [...prev, ...newPlayers.map((p, i) => ({ ...p, id: Math.max(...prev.map(x => x.id), 0) + i + 1 }))]);
        setUploadMsg(`Imported ${newPlayers.length} players from ${file.name}`);
      }
      setTimeout(() => setUploadMsg(null), 5000);
    } catch (err) {
      setUploadMsg("Error reading file: " + err.message);
    }
    e.target.value = "";
  };

  const addPlayer = async () => {
    const newPlayer = { name: "New, Player", ghin: "", courseHdcp: 15, index: 15.0, phone: "", email: "", memberNumber: "", status: "not_contacted", contactOwner: "", contactDate: "", availability: { 1: "no", 2: "no", 3: "no" }, locPref: { 1: "", 2: "", 3: "" }, notes: "EDIT ME" };
    if (addPlayerWithSync) {
      const newId = await addPlayerWithSync(newPlayer);
      if (newId) setEditingId(newId);
    } else {
      const newId = Math.max(...players.map(p => p.id), 0) + 1;
      setPlayers(prev => [...prev, { ...newPlayer, id: newId }]);
      setEditingId(newId);
    }
  };

  return (
    <div>
      {/* ROSTER UPLOAD */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #d1d9e6", padding: "10px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>Update Roster</span>
        <span style={{ fontSize: 11, color: "#94a3b8", borderLeft: "1px solid #e2e8f0", paddingLeft: 12, whiteSpace: "nowrap" }}>Re-import .csv or .xlsx to add or update players</span>
        <label style={{ padding: "6px 14px", borderRadius: 6, border: "2px dashed #7dd3fc", background: "#f0f9ff", color: "#0369a1", fontWeight: 600, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          📁 Choose File
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} style={{ display: "none" }} />
        </label>
        <span title={"Columns: First Name, Last Name, GHIN, Home Course HDCP, Player Low HI, Member Number, Phone, Email, Notes"} style={{ fontSize: 11, color: "#94a3b8", cursor: "help", userSelect: "none" }}>ℹ️ Column guide</span>
        {uploadMsg && <span style={{ fontSize: 12, fontWeight: 600, color: uploadMsg.includes("Error") || uploadMsg.includes("not") ? "#dc2626" : "#16a34a", background: uploadMsg.includes("Error") || uploadMsg.includes("not") ? "#fee2e2" : "#dcfce7", padding: "4px 10px", borderRadius: 6 }}>{uploadMsg}</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => exportRosterToExcel(players, "available", clubName)}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Available
          </button>
          <button onClick={() => exportRosterToExcel(players, "all", clubName)}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export All
          </button>
        </div>
      </div>

      <div className="mg-filter-bar" style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 200px", position: "relative", display: "flex", alignItems: "center" }}>
          <svg style={{ position: "absolute", left: 10, width: 14, height: 14, pointerEvents: "none" }} viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or GHIN..." style={{ width: "100%", padding: "8px 14px 8px 30px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 13, background: "#f5f7fb", outline: "none" }} />
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <svg style={{ position: "absolute", left: 8, width: 12, height: 12, pointerEvents: "none" }} viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "8px 12px 8px 26px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 12, background: "#f5f7fb", cursor: "pointer", appearance: "auto" }}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <svg style={{ position: "absolute", left: 8, width: 12, height: 12, pointerEvents: "none" }} viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={{ padding: "8px 12px 8px 26px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 12, background: "#f5f7fb", cursor: "pointer", appearance: "auto" }}>
            <option value="all">All Teams</option>
            {Array.from({ length: overallTC }, (_, i) => <option key={i} value={i}>Team {i + 1}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f5f7fb", borderRadius: 8, border: "1px solid #c1cad8", padding: "4px 8px" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>Avail:</span>
          {[["filterWk1", filterWk1, setFilterWk1, "Wk1"], ["filterWk2", filterWk2, setFilterWk2, "Wk2"], ["filterWk3", filterWk3, setFilterWk3, "Wk3"]].map(([key, val, setter, label]) => (
            <select key={key} value={val} onChange={e => setter(e.target.value)} style={{ padding: "4px 6px", borderRadius: 6, border: `1px solid ${val !== "all" ? "#38bdf8" : "#c1cad8"}`, fontSize: 11, background: val !== "all" ? "#e0f2fe" : "#fff", color: val !== "all" ? "#0369a1" : "#374151", fontWeight: val !== "all" ? 700 : 400, cursor: "pointer", appearance: "auto" }}>
              <option value="all">{label}</option>
              <option value="yes">{label}: Yes</option>
              <option value="no">{label}: No</option>
              <option value="maybe">{label}: Maybe</option>
            </select>
          ))}
        </div>
        <button onClick={() => setAddPlayerModal(true)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: ACCENT, fontWeight: 600, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>+ Add Player</button>
        <div style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", fontWeight: 600 }}>{filtered.length} of {players.length}</div>
      </div>
      {/* Summary bar */}
      {(() => {
        const statusCounts = {};
        Object.keys(STATUS_CONFIG).forEach(k => statusCounts[k] = 0);
        players.forEach(p => { if (statusCounts[p.status] !== undefined) statusCounts[p.status]++; });
        const wkCounts = [1, 2, 3].map(w => {
          let yes = 0, no = 0, maybe = 0;
          players.forEach(p => { if (p.availability[w] === "yes") yes++; else if (p.availability[w] === "maybe") maybe++; else no++; });
          return { yes, no, maybe };
        });
        return (
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 auto", background: "#fff", borderRadius: 10, border: "1px solid #d1d9e6", padding: "10px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Status:</span>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <span key={k} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: v.bg, color: v.color }}>{v.label} {statusCounts[k]}</span>
              ))}
            </div>
            {[1, 2, 3].map(w => (
              <div key={w} style={{ background: "#fff", borderRadius: 10, border: "1px solid #d1d9e6", padding: "10px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Wk{w}:</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a" }}>{wkCounts[w-1].yes}Y</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#dc2626" }}>{wkCounts[w-1].no}N</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#8b5cf6" }}>{wkCounts[w-1].maybe}M</span>
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "hidden" }}>
        <div className="mg-table-wrap" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: "linear-gradient(135deg, #0f172a 0%, #162d50 100%)", color: ACCENT }}>
              {[
                { label: "Proj", field: null },
                { label: "Player", field: "name" },
                { label: "HDCP", field: "courseHdcp" },
                { label: "Low HI", field: "index" },
                { label: "GHIN", field: "ghin" },
                { label: "Contact", field: null },
                { label: "Status", field: "status" },
                { label: "Wk1", field: "wk1" },
                { label: "Wk2", field: "wk2" },
                { label: "Wk3", field: "wk3" },
                { label: "Notes", field: null },
                { label: "", field: null },
              ].map(h => (
                <th key={h.label} onClick={h.field ? () => toggleSort(h.field) : undefined}
                  style={{ padding: "10px 6px", textAlign: "left", fontWeight: 600, fontSize: 10, letterSpacing: 0.5, whiteSpace: "nowrap", cursor: h.field ? "pointer" : "default", userSelect: "none" }}>
                  {h.label}{h.field ? sortArrow(h.field) : ""}
                </th>
              ))}
            </tr></thead>
            <tbody>
              {displayRows.map((p, i) => {
                const s = STATUS_CONFIG[p.status];
                const projIdx = projectTeam(p, overallSplit.thresholds);
                const ptc = TEAM_COLORS[projIdx] || TEAM_COLORS[0];
                return (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#f5f7fb", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "6px", textAlign: "center" }}><span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: ptc.bg, color: ptc.color }}>T{projIdx+1}</span></td>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                      {editingId === p.id
                        ? <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <input value={p.name} onChange={e => updatePlayer(p.id, "name", e.target.value)} placeholder="Last, First" style={{ fontSize: 12, padding: "2px 6px", border: "1px solid #38bdf8", borderRadius: 4, width: "100%", background: "#eff6ff", fontWeight: 600 }} />
                            <input value={p.memberNumber || ""} onChange={e => updatePlayer(p.id, "memberNumber", e.target.value)} placeholder="Member #" style={{ fontSize: 11, padding: "2px 6px", border: "1px solid #38bdf8", borderRadius: 4, width: "100%", background: "#eff6ff", color: "#64748b" }} />
                          </div>
                        : <div onClick={() => setEditingId(p.id)} style={{ cursor: "pointer" }}>
                            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 13 }}>{p.name}</div>
                            {p.memberNumber && <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.3 }}>#{p.memberNumber}</div>}
                          </div>}
                    </td>
                    <td style={{ padding: "6px", fontWeight: 600, color: "#0f172a", textAlign: "center" }}>
                      {editingId === p.id ? <input type="number" step="0.1" value={p.courseHdcp} onChange={e => updatePlayer(p.id, "courseHdcp", parseFloat(e.target.value) || 0)} style={{ fontSize: 11, padding: "2px 4px", border: "1px solid #38bdf8", borderRadius: 4, width: 45, background: "#eff6ff", fontWeight: 600, textAlign: "center" }} />
                        : <span onClick={() => setEditingId(p.id)} style={{ cursor: "pointer" }}>{fmtH(p.courseHdcp)}</span>}
                    </td>
                    <td style={{ padding: "6px", color: "#64748b", textAlign: "center" }}>
                      {editingId === p.id ? <input type="number" step="0.1" value={p.index} onChange={e => updatePlayer(p.id, "index", parseFloat(e.target.value) || 0)} style={{ fontSize: 11, padding: "2px 4px", border: "1px solid #38bdf8", borderRadius: 4, width: 45, background: "#eff6ff", textAlign: "center" }} />
                        : <span onClick={() => setEditingId(p.id)} style={{ cursor: "pointer" }}>{p.index}</span>}
                    </td>
                    <td style={{ padding: "6px", color: "#64748b", fontFamily: "monospace", fontSize: 10 }}>
                      {editingId === p.id ? <input value={p.ghin} onChange={e => updatePlayer(p.id, "ghin", e.target.value)} style={{ fontSize: 10, padding: "2px 4px", border: "1px solid #38bdf8", borderRadius: 4, width: 70, background: "#eff6ff", fontFamily: "monospace" }} />
                        : <span onClick={() => setEditingId(p.id)} style={{ cursor: "pointer" }}>{p.ghin}</span>}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      {editingId === p.id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <input value={p.phone} onChange={e => updatePlayer(p.id, "phone", e.target.value)} placeholder="Phone" style={{ fontSize: 10, padding: "2px 5px", border: "1px solid #38bdf8", borderRadius: 4, width: 110, background: "#eff6ff" }} />
                          <input value={p.email} onChange={e => updatePlayer(p.id, "email", e.target.value)} placeholder="Email" style={{ fontSize: 10, padding: "2px 5px", border: "1px solid #38bdf8", borderRadius: 4, width: 110, background: "#eff6ff" }} />
                          {p.contactOwner && <span style={{ fontSize: 9, color: "#64748b", background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>{p.contactOwner}</span>}
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          {p.phone ? <a href={`sms:${p.phone}`} title={p.phone} style={{ fontSize: 12, textDecoration: "none" }}>📞</a> : <span onClick={() => setEditingId(p.id)} style={{ fontSize: 9, color: "#94a3b8", cursor: "pointer" }}>+phone</span>}
                          {p.email ? <a href={`mailto:${p.email}`} title={p.email} style={{ fontSize: 12, textDecoration: "none" }}>✉️</a> : <span onClick={() => setEditingId(p.id)} style={{ fontSize: 9, color: "#94a3b8", cursor: "pointer" }}>+email</span>}
                          {p.contactOwner && <span style={{ fontSize: 9, color: "#64748b", background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>{p.contactOwner}</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "6px", position: "relative" }}>
                      <button onClick={() => setStatusOpenId(statusOpenId === p.id ? null : p.id)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 12, border: `1px solid ${s.color}44`, background: s.bg, color: s.color, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                        {s.label} <span style={{ fontSize: 8 }}>▼</span>
                      </button>
                      {statusOpenId === p.id && (
                        <>
                          <div onClick={() => setStatusOpenId(null)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                          <div style={{ position: "absolute", top: "100%", left: 6, zIndex: 200, background: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0", padding: 4, minWidth: 120 }}>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <button key={k} onClick={() => { updatePlayer(p.id, "status", k); setStatusOpenId(null); }}
                                style={{ display: "block", width: "100%", padding: "5px 10px", borderRadius: 6, border: p.status === k ? `2px solid ${v.color}` : "2px solid transparent", background: p.status === k ? v.bg : "#fff", color: v.color, fontWeight: p.status === k ? 700 : 500, fontSize: 11, cursor: "pointer", textAlign: "left", marginBottom: 2 }}>
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </td>
                    {[1, 2, 3].map(w => (
                      <td key={`w${w}`} style={{ padding: "3px 4px", textAlign: "center" }}>
                        <select value={p.availability[w]} onChange={e => updateAvail(p.id, w, e.target.value)} style={{ fontSize: 10, padding: "2px 2px", borderRadius: 4, border: `1px solid ${(AVAIL_COLORS[p.availability[w]] || "#ccc")}44`, background: p.availability[w] === "yes" ? "#dcfce7" : p.availability[w] === "maybe" ? "#ede9fe" : "#fee2e2", color: AVAIL_COLORS[p.availability[w]] || "#666", fontWeight: 600, cursor: "pointer", width: 52, display: "block", marginBottom: 2 }}><option value="no">No</option><option value="yes">Yes</option><option value="maybe">Maybe</option></select>
                        <select value={p.locPref[w]} onChange={e => updateLocPref(p.id, w, e.target.value)} style={{ fontSize: 9, padding: "1px 2px", borderRadius: 3, border: "1px solid #c1cad8", background: p.locPref[w] ? "#f0f9ff" : "#f5f7fb", color: p.locPref[w] ? "#0369a1" : "#94a3b8", cursor: "pointer", width: 52, display: "block" }}><option value="">loc –</option><option value="Home">Home</option><option value="Away">Away</option></select>
                      </td>
                    ))}
                    <td style={{ padding: "3px 6px" }}>
                      {editingId === p.id ? (
                        <input value={p.notes} onChange={e => updatePlayer(p.id, "notes", e.target.value)} placeholder="Notes..." style={{ fontSize: 10, padding: "2px 6px", border: "1px solid #38bdf8", borderRadius: 4, width: "100%", background: "#eff6ff" }} />
                      ) : <div onClick={() => setEditingId(p.id)} style={{ fontSize: 10, color: p.notes ? "#92400e" : "#ccc", cursor: "pointer", fontStyle: p.notes ? "italic" : "normal", minWidth: 50 }}>{p.notes || "+"}</div>}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {editingId === p.id ? (
                          <button onClick={() => setEditingId(null)} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: "none", background: "#16a34a", color: "#fff", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>✓ Done</button>
                        ) : (
                          <button onClick={() => setEditingId(p.id)} title="Edit player" aria-label={`Edit ${p.name}`} style={{ fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", cursor: "pointer", display: "flex", alignItems: "center" }}>✏️</button>
                        )}
                        <button onClick={() => { if (window.confirm(`Delete ${p.name} from the roster? This cannot be undone.`)) { deletePlayerFromDb(p.id); setPlayers(prev => prev.filter(pl => pl.id !== p.id)); } }}
                          title="Delete player" aria-label={`Delete ${p.name}`}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.25'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                          style={{ fontSize: 14, padding: "3px 5px", borderRadius: 4, border: "1px solid transparent", background: "transparent", color: "#94a3b8", cursor: "pointer", opacity: 0.25, lineHeight: 1 }}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Player Modal */}
      {addPlayerModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { setAddPlayerModal(false); setNewPlayerDraft(BLANK_DRAFT); setAddPlayerError(null); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div style={{ position: "relative", background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, #0f172a, #1e3a5f)", padding: "16px 24px", color: "#7dd3fc", fontSize: 16, fontWeight: 600 }}>Add Player</div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Last Name *</label>
                  <input autoFocus value={newPlayerDraft.lastName} onChange={e => setNewPlayerDraft(d => ({ ...d, lastName: e.target.value }))} onKeyDown={e => e.key === "Enter" && saveNewPlayer()} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>First Name</label>
                  <input value={newPlayerDraft.firstName} onChange={e => setNewPlayerDraft(d => ({ ...d, firstName: e.target.value }))} onKeyDown={e => e.key === "Enter" && saveNewPlayer()} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13 }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Course Handicap</label>
                  <input type="number" step="0.1" value={newPlayerDraft.courseHdcp} onChange={e => setNewPlayerDraft(d => ({ ...d, courseHdcp: e.target.value }))} onKeyDown={e => e.key === "Enter" && saveNewPlayer()} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Low Handicap Index</label>
                  <input type="number" step="0.1" value={newPlayerDraft.index} onChange={e => setNewPlayerDraft(d => ({ ...d, index: e.target.value }))} onKeyDown={e => e.key === "Enter" && saveNewPlayer()} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>GHIN</label>
                <input value={newPlayerDraft.ghin} onChange={e => setNewPlayerDraft(d => ({ ...d, ghin: e.target.value }))} onKeyDown={e => e.key === "Enter" && saveNewPlayer()} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Phone</label>
                  <input value={newPlayerDraft.phone} onChange={e => setNewPlayerDraft(d => ({ ...d, phone: e.target.value }))} onKeyDown={e => e.key === "Enter" && saveNewPlayer()} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Email</label>
                  <input value={newPlayerDraft.email} onChange={e => setNewPlayerDraft(d => ({ ...d, email: e.target.value }))} onKeyDown={e => e.key === "Enter" && saveNewPlayer()} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13 }} />
                </div>
              </div>
              {addPlayerError && <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{addPlayerError}</div>}
            </div>
            <div style={{ padding: "12px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => { setAddPlayerModal(false); setNewPlayerDraft(BLANK_DRAFT); setAddPlayerError(null); }} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #c1cad8", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveNewPlayer} disabled={addPlayerSaving} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc", fontWeight: 600, fontSize: 13, cursor: addPlayerSaving ? "wait" : "pointer", opacity: addPlayerSaving ? 0.7 : 1 }}>{addPlayerSaving ? "Saving..." : "Save Player"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Roster;
