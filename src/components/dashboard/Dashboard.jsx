import React, { useMemo } from "react";
import { fmtH, fmtDateLong } from "../../utils/format";
import { STATUS_CONFIG, TEAM_COLORS, AVAIL_COLORS, ACCENT } from "../../utils/constants";

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

function Dashboard({ players, schedule, lockState, clubName, assignments }) {
  const weekAnalysis = useMemo(() => [1, 2, 3].map(w => {
    const tc = schedule[w].teamCount || 2;
    const split = computeTeamSplit(players, w, tc);
    const maybe = players.filter(p => p.availability[w] === "maybe");
    return { week: w, ...split, teamCount: tc, maybeAll: maybe, date: schedule[w].date, teams: schedule[w].teams || [], ls: lockState[w] };
  }), [players, schedule, lockState]);

  const stats = useMemo(() => {
    const totalPlayers = players.length;
    const maxTeamCount = Math.max(...[1,2,3].map(w => schedule[w]?.teamCount || 2));
    const playersNeeded = maxTeamCount * 12;
    const rosterGap = Math.max(0, playersNeeded - totalPlayers);
    const confirmed = players.filter(p => p.status === "confirmed").length;
    const declined = players.filter(p => p.status === "declined").length;
    const maybeP = players.filter(p => [1,2,3].some(w => p.availability[w] === "maybe")).length;
    const contacted = players.filter(p => p.status === "contacted").length;
    const notContacted = players.filter(p => p.status === "not_contacted").length;
    const overallTC = schedule[1]?.teamCount || 2;
    const overallSplit = computeTeamSplit(players, 1, overallTC);
    const anyYes = players.filter(p => [1,2,3].some(w => p.availability[w] === "yes"));
    const overallAvgHdcp = anyYes.length > 0 ? (anyYes.reduce((s, p) => s + p.courseHdcp, 0) / anyYes.length).toFixed(1) : "—";
    return { totalPlayers, maxTeamCount, playersNeeded, rosterGap, confirmed, declined, maybeP, contacted, notContacted, overallSplit, overallAvgHdcp };
  }, [players, schedule]);

  const { totalPlayers, maxTeamCount, playersNeeded, rosterGap, confirmed, declined, maybeP, contacted, notContacted, overallSplit, overallAvgHdcp } = stats;

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 8, letterSpacing: 0.3 }}>Roster Recruitment</div>
      <div className="mg-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Rostered", val: totalPlayers, color: rosterGap > 0 ? "#dc2626" : "#0f172a", sub: `${playersNeeded} needed (${maxTeamCount} teams)` },
          { label: "Available", val: confirmed, color: "#16a34a", sub: "Signed up" },
          { label: "Maybe", val: maybeP, color: "#8b5cf6", sub: "Unsure any week" },
          { label: "Contacted", val: contacted, color: "#f59e0b", sub: "No replies" },
          { label: "Declined", val: declined, color: "#dc2626", sub: "Not playing" },
          { label: "Not Contacted", val: notContacted, color: "#94a3b8", sub: "Need outreach" },
        ].map(({ label, val, color, sub }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "14px 12px", border: "1px solid #d1d9e6", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 600, color }}>{val}</div>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: 0.5 }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* HANDICAP DISTRIBUTION */}
      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 8, letterSpacing: 0.3 }}>Home Course HDCP Distribution</div>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", padding: 16, marginBottom: 16 }}>
        {(() => {
          const hdcps = players.map(p => Math.floor(p.courseHdcp));
          const minH = hdcps.length > 0 ? Math.min(...hdcps) : 0;
          const maxH = hdcps.length > 0 ? Math.max(...hdcps) : 12;
          const range = maxH - minH;
          const numBuckets = Math.min(6, Math.max(3, Math.ceil(range / 3)));
          const bucketSize = Math.max(1, Math.ceil((range + 1) / numBuckets));
          const brackets = [];
          for (let i = 0; i < numBuckets; i++) {
            const bMin = minH + i * bucketSize;
            const bMax = i === numBuckets - 1 ? maxH : minH + (i + 1) * bucketSize - 1;
            if (bMin > maxH) break;
            brackets.push({ label: bMin === bMax ? `${bMin}` : `${bMin}–${bMax}`, min: bMin, max: bMax });
          }
          const maxCount = Math.max(...brackets.map(b => players.filter(p => p.courseHdcp >= b.min && p.courseHdcp <= b.max).length), 1);
          return (
            <div className="mg-hdcp-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${brackets.length}, 1fr)`, gap: 12 }}>
              {brackets.map(b => {
                const all = players.filter(p => p.courseHdcp >= b.min && p.courseHdcp <= b.max);
                const conf = all.filter(p => p.status === "confirmed");
                const may = all.filter(p => p.status === "maybe");
                const nc = all.filter(p => p.status === "not_contacted" || p.status === "contacted");
                const projIdx = projectTeam({ courseHdcp: (b.min + b.max) / 2 }, overallSplit.thresholds);
                const ptc = TEAM_COLORS[projIdx] || TEAM_COLORS[0];
                return (
                  <div key={b.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>Home Course HDCP {b.label}</div>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: ptc.bg, color: ptc.color, fontWeight: 600 }}>T{projIdx+1}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", height: 80, justifyContent: "flex-end", borderRadius: 5, overflow: "hidden", background: "#f1f5f9", position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                        <div style={{ height: `${(all.length / maxCount) * 100}%`, minHeight: all.length > 0 ? 8 : 0, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                          {nc.length > 0 && <div style={{ height: `${(nc.length / all.length) * 100}%`, minHeight: 4, background: "linear-gradient(180deg, #94a3b8, #64748b)", transition: "height 0.3s" }} />}
                          {may.length > 0 && <div style={{ height: `${(may.length / all.length) * 100}%`, minHeight: 4, background: "linear-gradient(180deg, #a78bfa, #7c3aed)", transition: "height 0.3s" }} />}
                          {conf.length > 0 && <div style={{ height: `${(conf.length / all.length) * 100}%`, minHeight: 4, background: "linear-gradient(180deg, #22c55e, #16a34a)", transition: "height 0.3s" }} />}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b", textAlign: "center", marginTop: 4 }}>{all.length} total · {conf.length} avail</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10, color: "#64748b", justifyContent: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#16a34a" }} /> Confirmed</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#8b5cf6" }} /> Maybe</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#94a3b8" }} /> Not Yet</span>
          <span style={{ marginLeft: 12, fontWeight: 600 }}>Avg Home Course HDCP (all rostered): {overallAvgHdcp}</span>
        </div>
      </div>

      {/* WEEKLY COVERAGE */}
      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 8, letterSpacing: 0.3 }}>Weekly Coverage</div>
      <div className="mg-pool-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[1, 2, 3].map(w => {
          const wa = weekAnalysis[w - 1];
          const need = wa.teamCount * 12;
          const confirmed = players.filter(p => p.availability[w] === "yes").length;
          const maybe = players.filter(p => p.availability[w] === "maybe").length;
          const pct = need > 0 ? Math.min(confirmed / need, 1) : 0;
          const short = Math.max(0, need - confirmed);
          const barColor = pct >= 1 ? "#16a34a" : pct >= 0.75 ? "#f59e0b" : "#dc2626";
          const locked = wa.ls.locked;
          let statusLabel, statusColor, statusBg;
          if (locked) {
            statusLabel = "🔒 Locked"; statusColor = "#166534"; statusBg = "#dcfce7";
          } else if (short === 0) {
            statusLabel = "✓ On track"; statusColor = "#166534"; statusBg = "#dcfce7";
          } else if (pct >= 0.75) {
            statusLabel = `⚠ Short by ${short}`; statusColor = "#92400e"; statusBg = "#fef3c7";
          } else {
            statusLabel = `✗ Short by ${short}`; statusColor = "#991b1b"; statusBg = "#fee2e2";
          }
          return (
            <div key={w} style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Week {w}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{fmtDateLong(wa.date) || "Date TBD"} · {wa.teamCount} team{wa.teamCount !== 1 ? "s" : ""}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: statusBg, color: statusColor }}>{statusLabel}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: barColor, lineHeight: 1 }}>{confirmed}</span>
                <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 500 }}>/ {need} needed players confirmed available</span>
              </div>
              <div style={{ background: "#e2e8f0", borderRadius: 99, height: 8, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${pct * 100}%`, height: "100%", background: barColor, borderRadius: 99, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>{Math.round(pct * 100)}% of roster filled</span>
                {maybe > 0 && <span style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600 }}>+{maybe} maybe</span>}
              </div>
            </div>
          );
        })}
      </div>

      {weekAnalysis.map(wa => (
        <div key={wa.week} style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #162d50 100%)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: ACCENT, fontSize: 17, fontWeight: 600 }}>Week {wa.week}</span>
              <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600 }}>{fmtDateLong(wa.date)}</span>
              <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: 10 }}>{wa.teamCount} team{wa.teamCount !== 1 ? "s" : ""}</span>
              {wa.ls.locked && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "#16a34a33", color: "#4ade80", fontWeight: 600 }}>LOCKED</span>}
              {wa.ls.modifiedAfterLock && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "#dc262633", color: "#fca5a5", fontWeight: 600 }}>STALE</span>}
            </div>
            {wa.thresholds.length > 0 && wa.thresholds.some(t => t !== null) && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {wa.thresholds.map((t, i) => t !== null ? <span key={i} style={{ fontSize: 12, color: "#cbd5e1" }}><span style={{ fontWeight: 600 }}>T{i+1}/T{i+2}:</span> <span style={{ fontSize: 16, fontWeight: 600, color: ACCENT }}>{fmtH(t)}</span></span> : null)}
              </div>
            )}
          </div>
          <div className="mg-week-teams" style={{ display: "grid", gridTemplateColumns: `repeat(${wa.teamCount}, 1fr)`, gap: 0 }}>
            {wa.teams.map((teamSched, idx) => {
              const weekAssign = assignments[wa.week] || {};
              const teamAssign = weekAssign[idx] || { home: [[], [], []], away: [[], [], []] };
              const assignedIds = new Set();
              ["home", "away"].forEach(s => (teamAssign[s] || []).forEach(pair => (pair || []).forEach(id => assignedIds.add(id))));
              const teamPlayers = players.filter(p => assignedIds.has(p.id)).sort((a, b) => a.courseHdcp - b.courseHdcp);
              const opp = teamSched.opponent || "";
              const num = teamSched.teamNum || "";
              const rangeData = teamPlayers.length > 0 ? { min: Math.min(...teamPlayers.map(p => p.courseHdcp)), max: Math.max(...teamPlayers.map(p => p.courseHdcp)) } : null;
              const have = teamPlayers.length;
              const gap = Math.max(0, 12 - have);
              const avgHdcp = teamPlayers.length > 0 ? (teamPlayers.reduce((s, p) => s + p.courseHdcp, 0) / teamPlayers.length).toFixed(1) : "—";
              const tc = TEAM_COLORS[idx] || TEAM_COLORS[0];
              return (
                <div key={idx} style={{ padding: 16, borderRight: idx < wa.teamCount - 1 ? "1px solid #d1d9e6" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>
                        <span style={{ background: tc.bg, color: tc.color, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, marginRight: 8 }}>{tc.label}</span>
                        vs {opp} {num}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>3 pairs at {clubName} · 3 pairs at {opp}</div>
                    </div>
                    {opp && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opp)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#1e40af", textDecoration: "none", background: "#dbeafe", padding: "3px 8px", borderRadius: 5, fontWeight: 600, whiteSpace: "nowrap" }}>Map</a>}
                  </div>
                  <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", background: "#e2e8f0", marginBottom: 6 }}>
                    <div style={{ width: `${Math.min(100, (have / 12) * 100)}%`, minWidth: have > 0 ? 40 : 0, background: have >= 12 ? "linear-gradient(90deg, #16a34a, #22c55e)" : `linear-gradient(90deg, ${tc.color}, ${tc.color}aa)`, transition: "width 0.3s", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 600 }}>{have}/12</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, marginBottom: 10 }}>
                    <div style={{ color: "#64748b" }}>{rangeData ? <span>Hdcp range: <b>{fmtH(rangeData.min)}–{fmtH(rangeData.max)}</b> <span style={{ marginLeft: 8, color: "#0f172a", fontWeight: 600 }}>Avg: {avgHdcp}</span></span> : <span>No players assigned yet</span>}</div>
                    <div>{gap > 0 ? <span style={{ color: "#dc2626", fontWeight: 600 }}>Need {gap} more</span> : <span style={{ color: "#16a34a", fontWeight: 600 }}>Full</span>}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {teamPlayers.map(p => { const parts = p.name.split(","); const last = parts[0].trim(); const first = (parts[1] || "").trim(); const display = first ? `${first.charAt(0)}. ${last}` : last; return (<span key={p.id} style={{ fontSize: 10, background: tc.bg, color: tc.color, padding: "2px 6px", borderRadius: 4, fontWeight: 600, whiteSpace: "nowrap" }}>{display} ({fmtH(p.courseHdcp)})</span>); })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #162d50 100%)", color: ACCENT, padding: "10px 16px", fontSize: 15, fontWeight: 600 }}>Follow-Up Targets</div>
          <div className="mg-followup-grid" style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
            {[
              { title: "CONTACTED — Awaiting Reply", filter: p => p.status === "contacted", bg: "#fef9c3", color: "#f59e0b", extra: p => p.contactOwner ? `By: ${p.contactOwner}` : "" },
              { title: "MAYBE — On the Fence", filter: p => p.status === "maybe", bg: "#ede9fe", color: "#8b5cf6", extra: p => "Wks: " + [1,2,3].filter(w => p.availability[w] === "maybe").join(", ") },
              { title: "NOT CONTACTED — Recruits", filter: p => p.status === "not_contacted", bg: "#f1f5f9", color: "#94a3b8", extra: p => "Index: " + p.index },
              { title: "DECLINED — Re-Recruit", filter: p => p.status === "declined", bg: "#fee2e2", color: "#dc2626", extra: p => "Hdcp: " + fmtH(p.courseHdcp) },
            ].map(group => {
              const list = players.filter(group.filter).sort((a, b) => a.courseHdcp - b.courseHdcp);
              return (
                <div key={group.title}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: group.color, marginBottom: 6 }}>{group.title}</div>
                  {list.length === 0 && <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>None</div>}
                  {list.map(p => {
                    const projIdx = projectTeam(p, overallSplit.thresholds);
                    const ptc = TEAM_COLORS[projIdx] || TEAM_COLORS[0];
                    return (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: group.bg, borderRadius: 6, marginBottom: 3, fontSize: 11 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: ptc.bg, color: ptc.color }}>T{projIdx+1}</span>
                          <span style={{ fontWeight: 600 }}>{p.name} ({fmtH(p.courseHdcp)})</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ color: "#64748b", fontSize: 10 }}>{group.extra(p)}</span>
                          {p.phone && <a href={`sms:${p.phone}`} style={{ fontSize: 12, textDecoration: "none" }}>📞</a>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
}

export default Dashboard;
