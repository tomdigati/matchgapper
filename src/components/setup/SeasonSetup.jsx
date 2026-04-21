import React from "react";
import { fmtDateLong } from "../../utils/format";
import { ACCENT, TEAM_COLORS, EMPTY_TEAM } from "../../utils/constants";
import ClubSearchDropdown from "../ui/ClubSearchDropdown";

const IconLock = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);

function SeasonSetup({ schedule, setSchedule, lockState, userRole, clubName }) {
  const isAdmin = userRole === "admin" || userRole === "captain";
  const updateWeek = (week, field, value) => {
    if (!isAdmin) return;
    setSchedule(prev => ({ ...prev, [week]: { ...prev[week], [field]: value } }));
  };
  const updateTeam = (week, idx, field, value) => {
    if (!isAdmin) return;
    setSchedule(prev => {
      const newTeams = [...prev[week].teams];
      newTeams[idx] = { ...newTeams[idx], [field]: value };
      return { ...prev, [week]: { ...prev[week], teams: newTeams } };
    });
  };
  const updateTeamCount = (week, newCount) => {
    if (!isAdmin) return;
    setSchedule(prev => {
      const next = { ...prev };
      [1, 2, 3].forEach(w => {
        const ws = next[w];
        const oldTeams = ws.teams || [];
        const teams = [];
        for (let i = 0; i < newCount; i++) {
          teams.push(oldTeams[i] || EMPTY_TEAM());
        }
        next[w] = { ...ws, teamCount: newCount, teams };
      });
      return next;
    });
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#0f172a" }}>Season Setup</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Configure opponents for each week. Each matchup splits 3 pairs home, 3 pairs away. Searchable across all 334 GAP member clubs.</p>
        </div>
        {!isAdmin && <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>View Only — Admin access required to edit</span>}
      </div>

      {[1, 2, 3].map(week => {
        const ws = schedule[week];
        const ls = lockState[week];
        const locked = ls?.locked;
        const teamCount = ws.teamCount || 2;
        const teams = ws.teams || [];
        return (
          <div key={week} style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "visible", marginBottom: 16, opacity: locked ? 0.85 : 1, position: "relative", zIndex: 10 - week }}>
            <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #162d50 100%)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "12px 12px 0 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: ACCENT, fontSize: 17, fontWeight: 600 }}>Week {week}</span>
                {locked && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: "#dc262622", color: "#fca5a5", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IconLock /> LOCKED</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {ws.date && <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600 }}>{fmtDateLong(ws.date)}</span>}
                <input type="date" value={ws.date} onChange={e => updateWeek(week, "date", e.target.value)} disabled={!isAdmin || locked}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#cbd5e1", fontSize: 13, fontWeight: 600 }} />
              </div>
            </div>
            <div style={{ padding: 16 }}>
              {/* Number of Teams selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "12px 16px", background: "#f0f9ff", borderRadius: 10, border: "1px solid #bae6fd" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0369a1" }}>Number of Teams</span>
                <select value={teamCount} onChange={e => updateTeamCount(week, parseInt(e.target.value))} disabled={!isAdmin || locked}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #bae6fd", background: "#fff", color: "#0f172a", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{ fontSize: 11, color: "#64748b" }}>Select how many team matchups for this week, then configure each below.</span>
              </div>
              {teams.map((team, idx) => {
                const tc = TEAM_COLORS[idx] || TEAM_COLORS[0];
                return (
                  <div key={idx} style={{ background: "#f5f7fb", borderRadius: 10, padding: 14, marginBottom: idx < teams.length - 1 ? 12 : 0, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: tc.bg, color: tc.color }}>{tc.label}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Opponent</span>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ flex: "1 1 250px" }}>
                        {isAdmin && !locked ? (
                          <ClubSearchDropdown value={team.opponent} onChange={v => updateTeam(week, idx, "opponent", v)} placeholder="Choose Opponent Club..." />
                        ) : (
                          <div style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #c1cad8", background: "#f1f5f9", fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{team.opponent || "Not set"}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select value={team.teamNum} onChange={e => updateTeam(week, idx, "teamNum", e.target.value)} disabled={!isAdmin || locked}
                          style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13, background: isAdmin && !locked ? "#fff" : "#f1f5f9", cursor: "pointer" }}>
                          {["#1","#2","#3","#4","#5","#6"].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Home Tee</span>
                        <input value={team.homeTee || ""} onChange={e => updateTeam(week, idx, "homeTee", e.target.value)} disabled={!isAdmin || locked} placeholder="8:00 AM"
                          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13, width: 90, background: isAdmin && !locked ? "#fff" : "#f1f5f9" }} />
                        <select value={team.homeInterval || 10} onChange={e => updateTeam(week, idx, "homeInterval", parseInt(e.target.value))} disabled={!isAdmin || locked}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 11, background: isAdmin && !locked ? "#fff" : "#f1f5f9", cursor: "pointer" }}>
                          {[10,11,12,13,14,15,16,17,18,19,20].map(m => <option key={m} value={m}>{m}m</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Away Tee</span>
                        <input value={team.awayTee || ""} onChange={e => updateTeam(week, idx, "awayTee", e.target.value)} disabled={!isAdmin || locked} placeholder="8:30 AM"
                          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13, width: 90, background: isAdmin && !locked ? "#fff" : "#f1f5f9" }} />
                        <select value={team.awayInterval || 10} onChange={e => updateTeam(week, idx, "awayInterval", parseInt(e.target.value))} disabled={!isAdmin || locked}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 11, background: isAdmin && !locked ? "#fff" : "#f1f5f9", cursor: "pointer" }}>
                          {[10,11,12,13,14,15,16,17,18,19,20].map(m => <option key={m} value={m}>{m}m</option>)}
                        </select>
                      </div>
                    </div>
                    {team.opponent && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                        3 pairs at {clubName} · 3 pairs at {team.opponent}
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(team.opponent)}`} target="_blank" rel="noopener noreferrer"
                          style={{ marginLeft: 8, fontSize: 10, color: "#1e40af", textDecoration: "none", background: "#dbeafe", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>Map</a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SeasonSetup;
