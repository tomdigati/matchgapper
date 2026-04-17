import { useState } from "react";
import * as XLSX from "xlsx";
import { parseCSVLine } from "../../utils/csv";
import { ROLE_CONFIG } from "../../utils/constants";
import { bulkInsertPlayers } from "../../lib/players";
import { GAP_CLUBS, SAMPLE_PLAYERS } from "../../utils/data";


function OnboardingWizard({ profile, session, onComplete, onSetTeamCount }) {
  const [step, setStep] = useState(1); // 1=welcome, 2=upload, 3=review
  const [importedPlayers, setImportedPlayers] = useState([]);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [teamCount, setTeamCount] = useState(2);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) { setUploadMsg({ type: "error", msg: "File too large. Maximum size is 5MB." }); return; }
    const validTypes = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext) && !validTypes.includes(file.type)) {
      setUploadMsg({ type: "error", msg: "Invalid file type. Please upload a CSV or Excel file." }); return;
    }
    try {
      let text = "";
      if (ext === "xlsx" || ext === "xls") {

        if (!XLSX) { setUploadMsg({ type: "error", msg: "Excel library not loaded. Please refresh and try again." }); return; }
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(ws);
      } else {
        text = await file.text();
      }
      if (!text) { setUploadMsg({ type: "error", msg: "Could not read file." }); return; }

      const lines = text.trim().split("\n").map(l => parseCSVLine(l));
      if (lines.length < 2) { setUploadMsg({ type: "error", msg: "File appears empty." }); return; }
      const header = lines[0].map(h => h.toLowerCase().trim());
      const firstNameIdx = header.findIndex(h => h === "first name" || h === "firstname" || h === "first");
      const lastNameIdx = header.findIndex(h => h === "last name" || h === "lastname" || h === "last");
      const nameIdx = header.findIndex(h => h === "name" || h === "player" || h === "player name");
      const ghinIdx = header.findIndex(h => h.includes("ghin"));
      const hdcpIdx = header.findIndex(h => h.includes("hdcp") || h.includes("handicap") || h.includes("course"));
      const indexIdx = header.findIndex(h => h.includes("index") || h.includes("low hi") || h.includes("player low"));
      const phoneIdx = header.findIndex(h => h.includes("phone") || h.includes("cell") || h.includes("mobile"));
      const emailIdx = header.findIndex(h => h.includes("email") || h.includes("e-mail"));
      const memberNumberIdx = header.findIndex(h => h.includes("member"));
      const notesIdx = header.findIndex(h => h.includes("note"));
      const hasSeparateNames = firstNameIdx > -1 && lastNameIdx > -1;
      if (!hasSeparateNames && nameIdx === -1) { setUploadMsg({ type: "error", msg: "Could not find name columns. Use 'First Name' and 'Last Name' columns, or a single 'Name' column." }); return; }
      const getName = (row) => {
        if (hasSeparateNames) {
          const first = (row[firstNameIdx] || "").trim();
          const last = (row[lastNameIdx] || "").trim();
          return last && first ? `${last}, ${first}` : last || first || "Unknown";
        }
        return row[nameIdx] || "Unknown";
      };
      const hasData = (row) => hasSeparateNames ? ((row[firstNameIdx] || "").trim() || (row[lastNameIdx] || "").trim()) : (row[nameIdx] || "").trim();
      const players = lines.slice(1).filter(row => hasData(row)).map((row, i) => ({
        id: -(i + 1),
        name: getName(row),
        ghin: ghinIdx > -1 ? (row[ghinIdx] || "") : "",
        courseHdcp: hdcpIdx > -1 ? (parseFloat(row[hdcpIdx]) || 15) : 15,
        index: indexIdx > -1 ? (parseFloat(row[indexIdx]) || 15) : (hdcpIdx > -1 ? (parseFloat(row[hdcpIdx]) || 15) : 15),
        phone: phoneIdx > -1 ? (row[phoneIdx] || "") : "",
        email: emailIdx > -1 ? (row[emailIdx] || "") : "",
        memberNumber: memberNumberIdx > -1 ? (row[memberNumberIdx] || "") : "",
        status: "not_contacted", contactOwner: "", contactDate: "",
        availability: { 1: "no", 2: "no", 3: "no" },
        locPref: { 1: "", 2: "", 3: "" }, notes: notesIdx > -1 ? (row[notesIdx] || "") : "",
      }));
      setImportedPlayers(players);
      setUploadMsg({ type: "success", msg: `Found ${players.length} players in ${file.name}` });
      setStep(3);
    } catch (err) {
      setUploadMsg({ type: "error", msg: "Error reading file: " + err.message });
    }
    e.target.value = "";
  };

  const addManualPlayer = () => {
    const tempId = -(importedPlayers.length + 1);
    setImportedPlayers(prev => [...prev, {
      id: tempId, name: "Last, First", ghin: "", courseHdcp: 15, index: 15.0,
      phone: "", email: "", memberNumber: "", status: "not_contacted", contactOwner: "", contactDate: "",
      availability: { 1: "no", 2: "no", 3: "no" }, locPref: { 1: "", 2: "", 3: "" }, notes: "",
    }]);
    setEditingId(tempId);
  };

  const updatePlayer = (id, field, value) => {
    setImportedPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removePlayer = (id) => {
    setImportedPlayers(prev => prev.filter(p => p.id !== id));
  };

  const handleFinish = async () => {
    if (importedPlayers.length === 0) {
      // Mark onboarded even with no players
      await supabase.from("profiles").update({ onboarded: true }).eq("id", session.user.id);
      onComplete();
      return;
    }
    setSaving(true);
    await bulkInsertPlayers(importedPlayers, profile.club, session.user.id);
    await supabase.from("profiles").update({ onboarded: true }).eq("id", session.user.id);
    setSaving(false);
    onComplete();
  };

  return (
    <div style={{ fontFamily: "'Poppins', 'Segoe UI', -apple-system, sans-serif", background: "#eef2f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 800, background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "24px 32px", borderBottom: "3px solid #7dd3fc" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #7dd3fc, #38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 600, color: "#0f172a" }}>M</div>
              <div>
                <div style={{ color: "#7dd3fc", fontSize: 18, fontWeight: 600 }}>MatchGapper Setup</div>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>{profile.club}</div>
              </div>
            </div>
            {/* Step indicator */}
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, background: step >= s ? "#7dd3fc" : "#334155", color: step >= s ? "#0f172a" : "#64748b", transition: "all 0.2s" }}>{s}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Welcome, {profile.full_name?.split(" ")[0] || "Captain"}!</div>
            <div style={{ fontSize: 15, color: "#64748b", marginBottom: 32, maxWidth: 500, margin: "0 auto 32px" }}>
              Let's get your {profile.club} roster set up for the BMW GAP Team Matches. You can upload a CSV file or add players manually.
            </div>
            <div style={{ background: "#f5f7fb", borderRadius: 12, padding: 24, maxWidth: 400, margin: "0 auto", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Your Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 13, textAlign: "left" }}>
                <span style={{ color: "#64748b" }}>Name:</span><span style={{ fontWeight: 600 }}>{profile.full_name}</span>
                <span style={{ color: "#64748b" }}>Club:</span><span style={{ fontWeight: 600 }}>{profile.club}</span>
                <span style={{ color: "#64748b" }}>Role:</span><span style={{ fontWeight: 600 }}>{ROLE_CONFIG[profile.role]?.label}</span>
              </div>
            </div>
            <div style={{ background: "#f0f9ff", borderRadius: 12, padding: 24, maxWidth: 400, margin: "24px auto 0", border: "1px solid #bae6fd" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", marginBottom: 8 }}>How many teams does your club field?</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>Each team has 12 players (3 home pairs + 3 away pairs). This applies to all 3 match weeks.</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => setTeamCount(n)}
                    style={{ width: 44, height: 44, borderRadius: 8, border: teamCount === n ? "2px solid #0369a1" : "1px solid #c1cad8", background: teamCount === n ? "#0369a1" : "#fff", color: teamCount === n ? "#fff" : "#0f172a", fontSize: 16, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>{teamCount} team{teamCount !== 1 ? "s" : ""} = {teamCount * 12} players needed</div>
            </div>
            <button onClick={() => { if (onSetTeamCount) onSetTeamCount(teamCount); setStep(2); }} style={{ marginTop: 32, padding: "14px 40px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc", fontWeight: 600, fontSize: 16, cursor: "pointer" }}>
              Get Started
            </button>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === 2 && (
          <div style={{ padding: "32px" }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Import Your Roster</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Upload a CSV or Excel file with your player list, or skip and add players manually.</div>

            {/* Column requirements */}
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", marginBottom: 10 }}>Column Requirements</div>
              <div style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.8 }}>
                <div>Your file should have a <strong>header row</strong> with the following column names:</div>
                <table style={{ width: "100%", fontSize: 11, marginTop: 8, borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: "1px solid #bae6fd" }}>
                    <th style={{ textAlign: "left", padding: "4px 8px", color: "#0369a1", fontWeight: 600 }}>Column</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", color: "#0369a1", fontWeight: 600 }}>Status</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", color: "#0369a1", fontWeight: 600 }}>Format</th>
                  </tr></thead>
                  <tbody>
                    <tr><td style={{ padding: "3px 8px", fontWeight: 600 }}>First Name</td><td style={{ padding: "3px 8px", color: "#dc2626", fontWeight: 600 }}>Required</td><td style={{ padding: "3px 8px", color: "#64748b" }}>e.g. James</td></tr>
                    <tr style={{ background: "#f8fafc" }}><td style={{ padding: "3px 8px", fontWeight: 600 }}>Last Name</td><td style={{ padding: "3px 8px", color: "#dc2626", fontWeight: 600 }}>Required</td><td style={{ padding: "3px 8px", color: "#64748b" }}>e.g. Anderson</td></tr>
                    <tr><td style={{ padding: "3px 8px", fontWeight: 600 }}>GHIN</td><td style={{ padding: "3px 8px", color: "#dc2626", fontWeight: 600 }}>Required</td><td style={{ padding: "3px 8px", color: "#64748b" }}>7-digit GHIN number</td></tr>
                    <tr style={{ background: "#f8fafc" }}><td style={{ padding: "3px 8px", fontWeight: 600 }}>Home Course HDCP</td><td style={{ padding: "3px 8px", color: "#dc2626", fontWeight: 600 }}>Required</td><td style={{ padding: "3px 8px", color: "#64748b" }}>Course handicap (e.g. 8)</td></tr>
                    <tr><td style={{ padding: "3px 8px", fontWeight: 600 }}>Player Low HI</td><td style={{ padding: "3px 8px", color: "#f59e0b", fontWeight: 600 }}>Recommended</td><td style={{ padding: "3px 8px", color: "#64748b" }}>Handicap index (e.g. 7.7)</td></tr>
                    <tr style={{ background: "#f8fafc" }}><td style={{ padding: "3px 8px", fontWeight: 600 }}>Phone</td><td style={{ padding: "3px 8px", color: "#94a3b8" }}>Optional</td><td style={{ padding: "3px 8px", color: "#64748b" }}>e.g. 610-555-0101</td></tr>
                    <tr><td style={{ padding: "3px 8px", fontWeight: 600 }}>Email</td><td style={{ padding: "3px 8px", color: "#94a3b8" }}>Optional</td><td style={{ padding: "3px 8px", color: "#64748b" }}>e.g. james@email.com</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Download template */}
            <button onClick={() => {
              const header = "First Name,Last Name,GHIN,Home Course HDCP,Player Low HI,Member Number,Phone,Email,Notes\n";
              const sample = "John,Smith,1234567,8.4,6.2,M101,6105551234,john.smith@email.com,\n";
              const tpl = header + sample;
              const blob = new Blob([tpl], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "matchgapper_roster_template.csv"; a.click(); URL.revokeObjectURL(url);
            }} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              Download Blank Template (.csv)
            </button>

            {/* Upload area */}
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", border: "3px dashed #7dd3fc", borderRadius: 12, background: "#f8fafc", cursor: "pointer", transition: "all 0.2s", marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>&#128193;</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>Click to upload your roster</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Accepts .csv and .xlsx files</div>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} style={{ display: "none" }} />
            </label>

            {uploadMsg && (
              <div style={{ background: uploadMsg.type === "error" ? "#fee2e2" : "#dcfce7", color: uploadMsg.type === "error" ? "#991b1b" : "#166534", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{uploadMsg.msg}</div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <button onClick={() => setStep(1)} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #c1cad8", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Back</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setStep(3); }} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #c1cad8", background: "#fff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Skip — Add Manually</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Edit */}
        {step === 3 && (
          <div style={{ padding: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 600, color: "#0f172a" }}>Review Your Roster</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{importedPlayers.length} player{importedPlayers.length !== 1 ? "s" : ""} — edit, add, or remove before saving</div>
              </div>
              <button onClick={addManualPlayer} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>+ Add Player</button>
            </div>

            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #d1d9e6", overflow: "hidden", maxHeight: 400, overflowY: "auto", marginBottom: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "linear-gradient(135deg, #0f172a 0%, #162d50 100%)", color: "#7dd3fc", position: "sticky", top: 0 }}>
                  {["Player Name*", "Home Course HDCP", "Player Low HI", "GHIN", "Phone", "Email", "Member #", ""].map(h => (
                    <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {importedPlayers.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No players yet. Click "+ Add Player" or go back to upload a CSV.</td></tr>
                  ) : importedPlayers.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#f5f7fb", borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 8px" }}>
                        {editingId === p.id ? <input value={p.name} onChange={e => updatePlayer(p.id, "name", e.target.value)} style={{ fontSize: 12, padding: "4px 6px", border: "1px solid #38bdf8", borderRadius: 4, width: "100%", background: "#eff6ff", fontWeight: 600 }} />
                          : <span onClick={() => setEditingId(p.id)} style={{ cursor: "pointer", fontWeight: 600 }}>{p.name}</span>}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        {editingId === p.id ? <input type="number" step="0.1" value={p.courseHdcp} onChange={e => updatePlayer(p.id, "courseHdcp", parseFloat(e.target.value) || 0)} style={{ fontSize: 11, padding: "4px", border: "1px solid #38bdf8", borderRadius: 4, width: 50, background: "#eff6ff", fontWeight: 600, textAlign: "center" }} />
                          : <span onClick={() => setEditingId(p.id)} style={{ cursor: "pointer", fontWeight: 600 }}>{Number(p.courseHdcp).toFixed(1)}</span>}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#64748b" }}>
                        {editingId === p.id ? <input type="number" step="0.1" value={p.index} onChange={e => updatePlayer(p.id, "index", parseFloat(e.target.value) || 0)} style={{ fontSize: 11, padding: "4px", border: "1px solid #38bdf8", borderRadius: 4, width: 50, background: "#eff6ff", textAlign: "center" }} />
                          : <span onClick={() => setEditingId(p.id)} style={{ cursor: "pointer" }}>{p.index}</span>}
                      </td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 10 }}>
                        {editingId === p.id ? <input value={p.ghin} onChange={e => updatePlayer(p.id, "ghin", e.target.value)} style={{ fontSize: 10, padding: "4px", border: "1px solid #38bdf8", borderRadius: 4, width: 70, background: "#eff6ff", fontFamily: "monospace" }} />
                          : <span onClick={() => setEditingId(p.id)} style={{ cursor: "pointer" }}>{p.ghin || "\u2014"}</span>}
                      </td>
                      <td style={{ padding: "6px 8px", fontSize: 11 }}>
                        {editingId === p.id ? <input value={p.phone} onChange={e => updatePlayer(p.id, "phone", e.target.value)} style={{ fontSize: 11, padding: "4px", border: "1px solid #38bdf8", borderRadius: 4, width: 100, background: "#eff6ff" }} />
                          : <span onClick={() => setEditingId(p.id)} style={{ cursor: "pointer", color: "#64748b" }}>{p.phone || "\u2014"}</span>}
                      </td>
                      <td style={{ padding: "6px 8px", fontSize: 11 }}>
                        {editingId === p.id ? <input value={p.email} onChange={e => updatePlayer(p.id, "email", e.target.value)} style={{ fontSize: 11, padding: "4px", border: "1px solid #38bdf8", borderRadius: 4, width: 130, background: "#eff6ff" }} />
                          : <span onClick={() => setEditingId(p.id)} style={{ cursor: "pointer", color: "#64748b" }}>{p.email || "\u2014"}</span>}
                      </td>
                      <td style={{ padding: "6px 8px", fontSize: 11 }}>
                        {editingId === p.id ? <input value={p.memberNumber || ""} onChange={e => updatePlayer(p.id, "memberNumber", e.target.value)} style={{ fontSize: 11, padding: "4px", border: "1px solid #38bdf8", borderRadius: 4, width: 80, background: "#eff6ff", fontFamily: "monospace" }} />
                          : <span onClick={() => setEditingId(p.id)} style={{ cursor: "pointer", color: "#64748b", fontFamily: "monospace" }}>{p.memberNumber || "\u2014"}</span>}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {editingId === p.id && <button onClick={() => setEditingId(null)} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: "none", background: "#16a34a", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Done</button>}
                          <button onClick={() => removePlayer(p.id)} style={{ fontSize: 9, padding: "3px 6px", borderRadius: 4, border: "1px solid #fca5a5", background: "#fff5f5", color: "#dc2626", cursor: "pointer" }}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setStep(2)} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #c1cad8", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Back</button>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {importedPlayers.length === 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>You can add players later from the Roster tab</span>}
                <button onClick={handleFinish} disabled={saving}
                  style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc", fontWeight: 600, fontSize: 15, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving..." : importedPlayers.length > 0 ? `Save ${importedPlayers.length} Players & Continue` : "Skip & Continue"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingWizard;
