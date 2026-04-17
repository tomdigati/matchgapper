import { useState, useMemo, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";
import { fmtH, fmtDate, fmtDateLong, addMinutes } from "../../utils/format";
import { TEAM_COLORS, AVAIL_COLORS, ACCENT, STATUS_CONFIG } from "../../utils/constants";
import * as XLSX from "xlsx";
import { parseName } from "../../utils/names";

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
// SVG ICONS
// ═══════════════════════════════════════════════════════════════
const IconLock = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
const IconUnlock = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>);

// ═══════════════════════════════════════════════════════════════
// TOOLTIP & PLAYER CARD
// ═══════════════════════════════════════════════════════════════
function Tooltip({ player, position, threshold }) {
  if (!player) return null;
  const s = STATUS_CONFIG[player.status];
  const projIdx = (threshold !== null && threshold !== undefined) ? projectTeam(player, threshold) : null;
  const ptc = projIdx !== null ? (TEAM_COLORS[projIdx] || TEAM_COLORS[0]) : null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const tipW = 320, tipH = 200;
  const left = Math.min(position.x + 16, vw - tipW - 12);
  const top = Math.min(Math.max(position.y - 10, 8), vh - tipH - 8);
  const el = (
    <div style={{ position: "fixed", top, left, zIndex: 99999, background: "#0f172a", color: "#eef2f7", borderRadius: 10, padding: "14px 18px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxWidth: tipW, fontSize: 13, lineHeight: 1.5, pointerEvents: "none", border: "1px solid #1e2d4a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: ACCENT }}>{player.name}</span>
        {ptc && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: ptc.color + "33", color: ptc.color }}>Proj: Team {projIdx+1}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 16px" }}>
        <span style={{ color: "#94a3b8" }}>GHIN:</span><span>{player.ghin}</span>
        <span style={{ color: "#94a3b8" }}>Course HDCP:</span><span style={{ fontWeight: 600 }}>{fmtH(player.courseHdcp)}</span>
        <span style={{ color: "#94a3b8" }}>Index:</span><span>{player.index}</span>
        <span style={{ color: "#94a3b8" }}>Status:</span><span style={{ color: s.color }}>{s.label}</span>
        {player.phone && <><span style={{ color: "#94a3b8" }}>Phone:</span><span>{player.phone}</span></>}
        {player.email && <><span style={{ color: "#94a3b8" }}>Email:</span><span style={{ fontSize: 11 }}>{player.email}</span></>}
      </div>
      {Object.values(player.locPref).some(v => v) && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e2d4a" }}>
          <span style={{ color: "#94a3b8" }}>Preferences: </span>
          {[1,2,3].map(w => player.locPref[w] ? <span key={w} style={{ marginRight: 8, background: "#1e2d4a", borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>Wk{w}: {player.locPref[w]}</span> : null)}
        </div>
      )}
      {player.notes && <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e2d4a", color: ACCENT, fontStyle: "italic", fontSize: 12 }}>{player.notes}</div>}
    </div>
  );
  return ReactDOM.createPortal(el, document.body);
}

function PlayerCard({ player, onDragStart, compact, week, threshold }) {
  const [hover, setHover] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const s = STATUS_CONFIG[player.status];
  const avail = week ? player.availability[week] : null;
  const pref = week ? player.locPref[week] : null;
  return (
    <>
      <div draggable onDragStart={(e) => { setHover(false); e.dataTransfer.setData("text/plain", player.id.toString()); onDragStart?.(player); }}
        onMouseEnter={(e) => { setHover(true); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
        onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHover(false)}
        style={{ background: "#fff", border: "1px solid #d1d9e6", borderRadius: 8, padding: compact ? "6px 10px" : "8px 12px", cursor: "grab", display: "flex", alignItems: "center", gap: 8, transition: "box-shadow 0.15s", boxShadow: hover ? "0 2px 8px rgba(0,0,0,0.1)" : "none", fontSize: compact ? 12 : 13 }}>
        <div style={{ width: compact ? 28 : 32, height: compact ? 28 : 32, borderRadius: "50%", background: `linear-gradient(135deg, ${s.color}22, ${s.color}44)`, border: `2px solid ${s.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: compact ? 11 : 13, color: s.color, flexShrink: 0 }}>{fmtH(player.courseHdcp)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "#0f172a", fontSize: compact ? 11 : 13 }}>{player.name}</div>
          {!compact && <div style={{ fontSize: 11, color: "#64748b" }}>Idx: {player.index} · {player.ghin}</div>}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          {pref && <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 5px", borderRadius: 4, background: pref === "Home" ? "#dbeafe" : "#fef3c7", color: pref === "Home" ? "#1e40af" : "#92400e" }}>{pref === "Home" ? "H" : "A"}</span>}
          {avail && <span style={{ width: 8, height: 8, borderRadius: "50%", background: AVAIL_COLORS[avail] }} />}
          <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: s.bg, color: s.color, fontWeight: 600 }}>{s.short}</span>
        </div>
      </div>
      {hover && <Tooltip player={player} position={tooltipPos} threshold={threshold} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAIR SLOT & ARCHETYPES
// ═══════════════════════════════════════════════════════════════
const PAIR_ARCHETYPES = {
  anchor: { label: "Anchor", emoji: "⚓", color: "#0369a1", bg: "#e0f2fe", tip: "Elite floor + upside partner. The low player covers par, partner plays free." },
  stacked: { label: "Stacked", emoji: "🔥", color: "#b91c1c", bg: "#fee2e2", tip: "Two elite players loaded up. Aggressive — bet on dominating this foursome." },
  balanced: { label: "Balanced", emoji: "⚖️", color: "#15803d", bg: "#dcfce7", tip: "Similar handicaps, steady and predictable. Win on consistency." },
  gambit: { label: "Gambit", emoji: "🎲", color: "#7e22ce", bg: "#f3e8ff", tip: "Higher handicaps together. Rolling the dice to stack firepower elsewhere." },
};

function detectArchetype(p1, p2) {
  if (!p1 || !p2) return null;
  const lo = Math.min(p1.courseHdcp, p2.courseHdcp), hi = Math.max(p1.courseHdcp, p2.courseHdcp), spread = hi - lo;
  if (lo <= 4 && hi >= 12) return "anchor";
  if (lo <= 5 && hi <= 7 && spread <= 4) return "stacked";
  if (lo >= 13) return "gambit";
  if (lo <= 4 && spread >= 5) return "anchor";
  if (lo <= 5 && hi <= 9) return "stacked";
  if (spread <= 3) return "balanced";
  if (spread >= 6) return "anchor";
  return "balanced";
}

function PairSlot({ pair, pairNum, onDrop, onRemove, players, side, week, threshold, disabled, teeOffset, baseTee }) {
  const [dragOver, setDragOver] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const cleanPair = (pair || []).filter(id => id != null && players.find(p => p.id === id));
  const p1 = cleanPair[0] ? players.find(p => p.id === cleanPair[0]) : null;
  const p2 = cleanPair[1] ? players.find(p => p.id === cleanPair[1]) : null;
  const avg = p1 && p2 ? ((p1.courseHdcp + p2.courseHdcp) / 2).toFixed(1) : p1 ? p1.courseHdcp.toFixed(1) : p2 ? p2.courseHdcp.toFixed(1) : "—";
  const archetype = detectArchetype(p1, p2);
  const arch = archetype ? PAIR_ARCHETYPES[archetype] : null;
  const prefWarnings = [];
  if (p1 && week && p1.locPref[week] && p1.locPref[week] !== side) prefWarnings.push(p1.name.split(",")[0]);
  if (p2 && week && p2.locPref[week] && p2.locPref[week] !== side) prefWarnings.push(p2.name.split(",")[0]);
  const pairTee = baseTee && teeOffset !== undefined ? addMinutes(baseTee, teeOffset) : null;
  return (
    <div onDragOver={(e) => { if (!disabled) { e.preventDefault(); setDragOver(true); } }} onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { if (!disabled) { e.preventDefault(); setDragOver(false); onDrop(parseInt(e.dataTransfer.getData("text/plain"))); } }}
      style={{ background: dragOver ? "#eff6ff" : "#f5f7fb", border: `2px dashed ${dragOver ? "#16a34a" : disabled ? "#e2e8f0" : "#c1cad8"}`, borderRadius: 10, padding: 12, minHeight: 90, transition: "all 0.2s", opacity: disabled ? 0.7 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: 1 }}>PAIR {pairNum}</span>
          {pairTee && <span style={{ fontSize: 10, fontWeight: 600, color: "#475569", background: "#e2e8f0", padding: "1px 6px", borderRadius: 4 }}>{pairTee}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {arch && (
            <div style={{ position: "relative", display: "inline-flex" }}>
              <span onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}
                style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: arch.bg, color: arch.color, cursor: "help", display: "flex", alignItems: "center", gap: 3, border: `1px solid ${arch.color}33` }}>
                {arch.emoji} {arch.label}
              </span>
              {showTip && (
                <div style={{ position: "absolute", bottom: "100%", right: 0, marginBottom: 6, background: "#0f172a", color: "#eef2f7", padding: "8px 12px", borderRadius: 8, fontSize: 11, lineHeight: 1.4, width: 220, boxShadow: "0 4px 16px rgba(0,0,0,0.3)", zIndex: 100, pointerEvents: "none" }}>
                  <div style={{ fontWeight: 600, color: ACCENT, marginBottom: 3 }}>{arch.emoji} {arch.label} Pairing</div>
                  {arch.tip}
                </div>
              )}
            </div>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", background: "#dce3ed", borderRadius: 6, padding: "2px 8px" }}>Avg: {avg}</span>
        </div>
      </div>
      {prefWarnings.length > 0 && <div style={{ fontSize: 10, color: "#92400e", background: "#fef3c7", borderRadius: 4, padding: "3px 6px", marginBottom: 6 }}>Pref conflict: {prefWarnings.join(", ")} prefers {side === "Home" ? "Away" : "Home"}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[0, 1].map(slot => {
          const player = slot === 0 ? p1 : p2;
          return player ? (
            <div key={slot} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ flex: 1 }}><PlayerCard player={player} compact week={week} threshold={threshold} /></div>
              <button
                onClick={() => disabled ? alert("Pairings are locked. Click 'Unlock to Edit' above to make changes.") : onRemove(player.id)}
                title={disabled ? "Unlock pairings to remove" : "Remove player"}
                style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${disabled ? "#e2e8f0" : "#e5d5d5"}`, background: disabled ? "#f1f5f9" : "#fff5f5", color: disabled ? "#94a3b8" : "#dc2626", cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {disabled ? "🔒" : "×"}
              </button>
            </div>
          ) : (
            <div key={slot} style={{ height: 38, border: `1px dashed ${disabled ? "#e2e8f0" : "#b8c2d1"}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 11 }}>{disabled ? "Locked" : "Drop player here"}</div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEAM BUILDER (with Lock/Unlock flow)
// ═══════════════════════════════════════════════════════════════
function TeamBuilder({ players, schedule, lockState, setLockState, userRole, clubName, assignments, setAssignments }) {
  const isAdmin = userRole === "admin" || userRole === "captain";
  const [activeWeek, setActiveWeek] = useState(1);
  const emptyWeek = (teamCount) => {
    const w = {};
    for (let i = 0; i < teamCount; i++) {
      w[i] = { home: [[], [], []], away: [[], [], []] };
    }
    return w;
  };
  const [validationMsg, setValidationMsg] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [dismissedStale, setDismissedStale] = useState(false);
  const weekSched = schedule[activeWeek];
  const weekLock = lockState[activeWeek];
  const isLocked = weekLock.locked;
  const teamCount = weekSched.teamCount || 2;
  const teamIndices = Array.from({length: teamCount}, (_, i) => i);
  const split = useMemo(() => computeTeamSplit(players, activeWeek, teamCount), [players, activeWeek, teamCount]);

  useEffect(() => {
    setAssignments(prev => {
      const w = prev[activeWeek] || {};
      let changed = false;
      const next = { ...w };
      for (let i = 0; i < teamCount; i++) {
        if (!next[i]) { next[i] = { home: [[], [], []], away: [[], [], []] }; changed = true; }
      }
      if (changed) return { ...prev, [activeWeek]: next };
      return prev;
    });
  }, [activeWeek, teamCount]);

  const assignedIds = useMemo(() => {
    const w = assignments[activeWeek] || {}; const ids = new Set();
    teamIndices.forEach(t => { const tw = w[t]; if (tw) ["home", "away"].forEach(s => (tw[s] || []).forEach(pair => pair.forEach(id => ids.add(id)))); });
    return ids;
  }, [assignments, activeWeek, teamCount]);
  const availablePlayers = useMemo(() => players.filter(p => p.availability[activeWeek] === "yes" && !assignedIds.has(p.id)).sort((a, b) => a.courseHdcp - b.courseHdcp), [players, activeWeek, assignedIds]);
  const maybePlayers = useMemo(() => players.filter(p => p.availability[activeWeek] === "maybe").sort((a, b) => a.courseHdcp - b.courseHdcp), [players, activeWeek]);

  const validate = useCallback((na) => {
    const w = na[activeWeek] || {};
    const teamPlayers = [];
    teamIndices.forEach(t => {
      const tp = [];
      const tw = w[t];
      if (tw) ["home", "away"].forEach(s => (tw[s] || []).forEach(pair => pair.forEach(id => { const p = players.find(pl => pl.id === id); if (p) tp.push(p); })));
      teamPlayers.push(tp);
    });
    for (let i = 0; i < teamPlayers.length - 1; i++) {
      if (teamPlayers[i].length > 0 && teamPlayers[i+1].length > 0) {
        const hiMax = Math.max(...teamPlayers[i].map(p => p.courseHdcp));
        const loMin = Math.min(...teamPlayers[i+1].map(p => p.courseHdcp));
        if (loMin < hiMax) return `VIOLATION: Team ${i+2} has a player at ${fmtH(loMin)} hdcp, lower than Team ${i+1}'s highest (${fmtH(hiMax)}). GAP rules require Team ${i+2} handicaps >= Team ${i+1}'s highest.`;
      }
    }
    return null;
  }, [activeWeek, players, teamCount]);

  const handleDrop = (teamIdx, side, pairIdx, playerId) => {
    if (isLocked) return;
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    if (split.thresholds.length > 0) {
      const projIdx = projectTeam(player, split.thresholds);
      if (projIdx !== teamIdx) {
        const lo = teamIdx === 0 ? null : split.thresholds[teamIdx - 1];
        const hi = teamIdx < split.thresholds.length ? split.thresholds[teamIdx] : null;
        setValidationMsg(`BLOCKED: ${player.name} (hdcp ${fmtH(player.courseHdcp)}) projects to Team ${projIdx+1}, not Team ${teamIdx+1}.`);
        return;
      }
    }
    setAssignments(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const w = next[activeWeek] || {};
      teamIndices.forEach(t => { const tw = w[t]; if (tw) ["home", "away"].forEach(s => (tw[s] || []).forEach(pair => { const idx = pair.indexOf(playerId); if (idx > -1) pair.splice(idx, 1); })); });
      if (w[teamIdx]) {
        if (!w[teamIdx][side]) w[teamIdx][side] = [[], [], []];
        if (!w[teamIdx][side][pairIdx]) w[teamIdx][side][pairIdx] = [];
        w[teamIdx][side][pairIdx] = w[teamIdx][side][pairIdx].filter(id => id != null && players.find(p => p.id === id));
        if (w[teamIdx][side][pairIdx].length < 2) w[teamIdx][side][pairIdx].push(playerId);
      }
      next[activeWeek] = w;
      setValidationMsg(validate(next)); return next;
    });
    if (weekLock.lastSentAt) {
      setLockState(prev => ({ ...prev, [activeWeek]: { ...prev[activeWeek], modifiedAfterLock: true } }));
    }
  };

  const handleRemove = (playerId) => {
    if (isLocked) return;
    setAssignments(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const w = next[activeWeek] || {};
      teamIndices.forEach(t => { const tw = w[t]; if (tw) ["home", "away"].forEach(s => (tw[s] || []).forEach(pair => { const idx = pair.indexOf(playerId); if (idx > -1) pair.splice(idx, 1); })); });
      next[activeWeek] = w;
      setValidationMsg(validate(next)); return next;
    });
    if (weekLock.lastSentAt) {
      setLockState(prev => ({ ...prev, [activeWeek]: { ...prev[activeWeek], modifiedAfterLock: true } }));
    }
  };

  const handleLock = () => {
    setLockState(prev => ({ ...prev, [activeWeek]: { ...prev[activeWeek], locked: true, lockedAt: new Date().toLocaleString(), lockedBy: "Admin" } }));
  };
  const handleUnlock = () => {
    setLockState(prev => ({ ...prev, [activeWeek]: { ...prev[activeWeek], locked: false } }));
  };

  const buildSummary = () => {
    const ws = schedule[activeWeek];
    const w = assignments[activeWeek] || {};
    let text = `${clubName.toUpperCase()} — BMW GAP TEAM MATCHES\nWeek ${activeWeek} · ${fmtDateLong(ws.date)}\n${"═".repeat(50)}\n`;
    (ws.teams || []).forEach((ts, idx) => {
      const tc = TEAM_COLORS[idx] || TEAM_COLORS[0];
      text += `\n${tc.label} vs ${ts.opponent} ${ts.teamNum}\nHome Tee (${clubName}): ${ts.homeTee || "TBD"} (${ts.homeInterval || 10}-min intervals) — Away Tee: ${ts.awayTee || "TBD"} (${ts.awayInterval || 10}-min intervals)\n${"─".repeat(40)}\n`;
      const tw = w[idx];
      if (tw) {
        ["home", "away"].forEach(side => {
          const loc = side === "home" ? clubName : ts.opponent;
          const baseTee = side === "home" ? ts.homeTee : ts.awayTee;
          (tw[side] || []).forEach((pair, i) => {
            const names = pair.map(id => { const p = players.find(pl => pl.id === id); if (!p) return "TBD"; let s = `${p.name} (${fmtH(p.courseHdcp)})`; if (p.memberNumber) s += ` [${p.memberNumber}]`; if (p.ghin) s += ` GHIN: ${p.ghin}`; return s; });
            const sideInterval = side === "home" ? (ts.homeInterval || 10) : (ts.awayInterval || 10);
            const pairTee = addMinutes(baseTee, i * sideInterval);
            if (names.length > 0) text += `  ${side.toUpperCase()} Pair ${i+1} @ ${pairTee} at ${loc}: ${names.join(" & ")}\n`;
          });
        });
      }
    });
    return text;
  };

  const handleCopy = () => {
    const text = buildSummary();
    navigator.clipboard?.writeText(text);
    setLockState(prev => ({ ...prev, [activeWeek]: { ...prev[activeWeek], lastSentAt: new Date().toLocaleString(), modifiedAfterLock: false } }));
    setCopyFeedback("Copied to clipboard!");
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const handleMail = () => {
    const text = buildSummary();
    setLockState(prev => ({ ...prev, [activeWeek]: { ...prev[activeWeek], lastSentAt: new Date().toLocaleString(), modifiedAfterLock: false } }));
    window.open(`mailto:?subject=${encodeURIComponent(`${clubName} Week ${activeWeek} Pairings — ${fmtDateLong(schedule[activeWeek].date)}`)}&body=${encodeURIComponent(text)}`);
  };

  const countAssigned = (teamIdx) => { const w = assignments[activeWeek] || {}; const tw = w[teamIdx]; let c = 0; if (tw) ["home", "away"].forEach(s => (tw[s] || []).forEach(pair => c += pair.length)); return c; };

  const teamPools = useMemo(() => {
    return teamIndices.map(idx => {
      return availablePlayers.filter(p => {
        const proj = projectTeam(p, split.thresholds);
        return proj === idx;
      });
    });
  }, [availablePlayers, split.thresholds, teamCount]);

  return (
    <div>

      {/* Week Selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[1, 2, 3].map(w => {
          const ls = lockState[w];
          const tc = schedule[w]?.teamCount || 2;
          return (
            <button key={w} onClick={() => { setActiveWeek(w); setValidationMsg(null); }} style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: activeWeek === w ? "2px solid #0f172a" : "1px solid #c1cad8", background: activeWeek === w ? "linear-gradient(135deg, #0f172a 0%, #162d50 100%)" : "#fff", color: activeWeek === w ? ACCENT : "#0f172a", fontWeight: 600, cursor: "pointer", fontSize: 13, transition: "all 0.2s", position: "relative" }}>
              <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                Week {w} — {fmtDate(schedule[w].date)}
                {ls.locked && <IconLock />}
              </div>
              <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>{tc} team{tc !== 1 ? "s" : ""}</div>
            </button>
          );
        })}
      </div>

      {/* Threshold Bar */}
      {split.thresholds.length > 0 && split.thresholds.some(t => t !== null) && (
        <div style={{ background: "#fff", border: "1px solid #d1d9e6", borderRadius: 8, padding: "10px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Team Thresholds: </span>
            {split.thresholds.map((t, i) => t !== null ? <span key={i} style={{ marginRight: 12 }}><span style={{ fontWeight: 600 }}>T{i+1}/T{i+2}: </span><span style={{ fontWeight: 600, fontSize: 16 }}>{fmtH(t)}</span></span> : null)}
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 12, flexWrap: "wrap" }}>
            {split.teams.map((team, idx) => {
              const tc = TEAM_COLORS[idx] || TEAM_COLORS[0];
              const r = split.ranges[idx];
              return <span key={idx} style={{ background: tc.bg, padding: "3px 10px", borderRadius: 6, fontWeight: 600, color: tc.color }}>T{idx+1}: {r ? `${fmtH(r.min)}–${fmtH(r.max)}` : "—"} ({team.length}p)</span>;
            })}
          </div>
        </div>
      )}

      {validationMsg && <div style={{ background: "#fef2f2", border: "2px solid #dc2626", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#991b1b", fontSize: 13, fontWeight: 600 }}>{validationMsg}</div>}

      {/* Main Grid */}
      <div className="mg-builder-grid" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, minHeight: 500 }}>
        <div style={{ background: "#f5f7fb", borderRadius: 12, padding: 14, border: "1px solid #d1d9e6", maxHeight: 750, overflowY: "auto" }}>
          {teamIndices.map((idx) => {
            const tc = TEAM_COLORS[idx] || TEAM_COLORS[0];
            const pool = teamPools[idx] || [];
            const r = split.ranges[idx];
            return (
              <div key={idx}>
                {idx > 0 && <div style={{ borderTop: "2px solid #c1cad8", paddingTop: 10, marginTop: 10, marginBottom: 2 }} />}
                <div style={{ fontSize: 11, fontWeight: 600, color: tc.color, marginBottom: 2, letterSpacing: 0.5 }}>{tc.label} POOL ({pool.length})</div>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>
                  {idx === 0 ? `Hdcp ≤ ${split.thresholds[0] != null ? fmtH(split.thresholds[0]) : "?"}` :
                   idx === teamCount - 1 ? `Hdcp ≥ ${split.thresholds[idx-1] != null ? fmtH(split.thresholds[idx-1]) : "?"}` :
                   `${fmtH(split.thresholds[idx-1] ?? 0)} < Hdcp ≤ ${fmtH(split.thresholds[idx] ?? 99)}`}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{pool.map(p => <PlayerCard key={p.id} player={p} compact week={activeWeek} threshold={split.thresholds} />)}</div>
              </div>
            );
          })}
          {maybePlayers.length > 0 && (
            <>
              <div style={{ borderTop: "2px solid #c1cad8", paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#8b5cf6", marginBottom: 2, letterSpacing: 0.5 }}>ON THE FENCE ({maybePlayers.length})</div>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>Team projection shown</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {maybePlayers.map(p => {
                  const projIdx = projectTeam(p, split.thresholds);
                  const ptc = TEAM_COLORS[projIdx] || TEAM_COLORS[0];
                  return (
                    <div key={p.id} style={{ position: "relative" }}>
                      <PlayerCard player={p} compact week={activeWeek} threshold={split.thresholds} />
                      <span style={{ position: "absolute", top: 2, right: 4, fontSize: 8, fontWeight: 600, padding: "1px 4px", borderRadius: 3, background: ptc.bg, color: ptc.color }}>T{projIdx+1}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Lock Controls (Admin only) */}
          {isAdmin && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {!isLocked ? (
                <button onClick={handleLock} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "2px solid #16a34a", background: "#dcfce7", color: "#16a34a", fontWeight: 600, cursor: "pointer", fontSize: 12 }}><IconLock /> Lock Pairings</button>
              ) : (
                <>
                  <button onClick={handleUnlock} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "2px solid #f59e0b", background: "#fef3c7", color: "#92400e", fontWeight: 600, cursor: "pointer", fontSize: 12 }}><IconUnlock /> Unlock to Edit</button>
                  <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #0f172a, #162d50)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Copy Summary</button>
                  <button onClick={handleMail} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Open in Mail</button>
                  <button onClick={() => exportPairingsToExcel(activeWeek, assignments, players, schedule, clubName)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export Week {activeWeek}
                  </button>
                </>
              )}
              {copyFeedback && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>{copyFeedback}</span>}
              {isLocked && <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>Locked {weekLock.lockedAt} by {weekLock.lockedBy}</span>}
            </div>
          )}
          {!isAdmin && isLocked && <div style={{ fontSize: 12, padding: "8px 14px", background: "#fef3c7", borderRadius: 8, color: "#92400e", fontWeight: 600 }}>Pairings locked by Admin — editing disabled</div>}

          {teamIndices.map(teamIdx => {
            const teams = weekSched.teams || [];
            const ts = teams[teamIdx] || { opponent: "", teamNum: "", homeTee: "", awayTee: "", homeInterval: 10, awayInterval: 10 };
            const tc = TEAM_COLORS[teamIdx] || TEAM_COLORS[0];
            return (
              <div key={teamIdx} style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "hidden" }}>
                <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #162d50 100%)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><span style={{ color: tc.color, fontSize: 16, fontWeight: 600 }}>Team {teamIdx+1}</span><span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 12 }}>{countAssigned(teamIdx)}/12 · vs {ts.opponent}</span>{ts.teamNum && <span style={{ color: "#fff", fontSize: 11, fontWeight: 600, marginLeft: 6, background: tc.color + "33", padding: "2px 8px", borderRadius: 4, letterSpacing: 0.5 }}>{ts.teamNum}</span>}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                      {teamIdx === 0 ? `Hdcp ≤ ${split.thresholds[0] != null ? fmtH(split.thresholds[0]) : "?"}` :
                       teamIdx === teamCount - 1 && teamCount > 1 ? `Hdcp ≥ ${split.thresholds[teamIdx-1] != null ? fmtH(split.thresholds[teamIdx-1]) : "?"}` :
                       teamCount === 1 ? "All handicaps" : `${fmtH(split.thresholds[teamIdx-1] ?? 0)} < Home Course HDCP ≤ ${fmtH(split.thresholds[teamIdx] ?? 99)}`}
                    </span>
                    {(() => {
                      const w = assignments[activeWeek] || {};
                      const tw = w[teamIdx] || { home: [[], [], []], away: [[], [], []] };
                      const assignedIds = new Set();
                      ["home", "away"].forEach(s => (tw[s] || []).forEach(pair => (pair || []).forEach(id => assignedIds.add(id))));
                    })()}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  {["Home", "Away"].map(side => {
                    const baseTee = side === "Home" ? ts.homeTee : ts.awayTee;
                    return (
                    <div key={side} style={{ padding: 12, borderRight: side === "Home" ? "1px solid #d1d9e6" : "none" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: side === "Home" ? "#1e40af" : "#92400e", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 14, height: 14, borderRadius: 3, background: side === "Home" ? "#dbeafe" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>{side === "Home" ? "H" : "A"}</span>
                        {side.toUpperCase()} — {side === "Home" ? clubName : ts.opponent}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>First tee: {baseTee || "TBD"} · {(side === "Home" ? (ts.homeInterval || 10) : (ts.awayInterval || 10))}-min intervals</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[0, 1, 2].map(i => (<PairSlot key={i} pair={(assignments[activeWeek]?.[teamIdx]?.[side.toLowerCase()] || [[],[],[]])[i] || []} pairNum={i + 1} onDrop={(id) => handleDrop(teamIdx, side.toLowerCase(), i, id)} onRemove={handleRemove} players={players} side={side} week={activeWeek} threshold={split.thresholds} disabled={isLocked} teeOffset={i * (side === "Home" ? (ts.homeInterval || 10) : (ts.awayInterval || 10))} baseTee={baseTee} />))}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TeamBuilder;
