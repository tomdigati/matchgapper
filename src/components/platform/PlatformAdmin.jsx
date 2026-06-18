import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { supabase } from "../../lib/supabase";
import { ROLE_CONFIG } from "../../utils/constants";
import { GAP_CLUBS } from "../../utils/data";

const IconPlatform = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>);

function PlatformAdmin({ currentUserId, onEnterClub }) {
  const [clubs, setClubs] = useState([]);
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteClub, setNewInviteClub] = useState("");
  const [newInviteRole, setNewInviteRole] = useState("captain");
  const [pgaRequired, setPgaRequired] = useState(true);
  const [playerCounts, setPlayerCounts] = useState({});
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [clubsRes, usersRes, invitesRes, playersRes] = await Promise.all([
      supabase.from("clubs").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("invitations").select("*").order("created_at", { ascending: false }),
      supabase.from("players").select("club"),
    ]);
    if (clubsRes.data) setClubs(clubsRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    if (invitesRes.data) setInvites(invitesRes.data);
    if (playersRes.data) {
      const counts = {};
      playersRes.data.forEach(p => { counts[p.club] = (counts[p.club] || 0) + 1; });
      setPlayerCounts(counts);
    }
    setLoading(false);
  }

  async function approveClub(club) {
    setProcessing(club.id);
    setFeedback(null);
    const { error: updateErr } = await supabase.from("clubs").update({ status: "approved", verified: true }).eq("id", club.id);
    if (updateErr) { setFeedback({ type: "error", msg: "Failed to approve: " + updateErr.message }); setProcessing(null); return; }
    const { data: inviteData, error: inviteErr } = await supabase.from("invitations").insert({
      email: club.pro_email, club: club.name, role: "admin", invited_by: currentUserId,
    }).select("token").single();
    if (inviteErr) {
      setFeedback({ type: "error", msg: "Club approved but invite creation failed: " + inviteErr.message });
    } else {
      const inviteUrl = `${window.location.origin}/?invite=${inviteData.token}`;
      try {
        await fetch("https://matchgapper-club-notify.tom-54b.workers.dev/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clubName: club.name,
            proName: club.pro_name,
            proEmail: club.pro_email,
            inviteToken: inviteData.token,
          }),
        });
      } catch (e) { console.error("Failed to send approval email:", e); }
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, status: "approved", verified: true } : c));
      setFeedback({ type: "success", msg: `${club.name} approved! Invite emailed to ${club.pro_email}` });
      loadAll();
    }
    setProcessing(null);
  }

  async function rejectClub(clubId) {
    setProcessing(clubId);
    const { error } = await supabase.from("clubs").update({ status: "rejected" }).eq("id", clubId);
    if (!error) setClubs(prev => prev.map(c => c.id === clubId ? { ...c, status: "rejected" } : c));
    setProcessing(null);
  }

  function initiateDeleteClub(clubId) {
    const club = clubs.find(c => c.id === clubId);
    setConfirmModal({ type: "club", id: clubId, name: club?.name, playerCount: playerCounts[club?.name] || 0, typedName: "" });
  }

  async function confirmDeleteClub() {
    const { id: clubId, name: clubName } = confirmModal;
    setConfirmModal(null);
    setProcessing(clubId);
    await supabase.from("players").delete().eq("club", clubName);
    await supabase.from("invitations").delete().eq("club", clubName);
    const { error } = await supabase.from("clubs").delete().eq("id", clubId);
    if (!error) {
      setClubs(prev => prev.filter(c => c.id !== clubId));
      setPlayerCounts(prev => { const n = { ...prev }; delete n[clubName]; return n; });
      setFeedback({ type: "success", msg: `${clubName} deleted` });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: "error", msg: "Failed to delete club: " + error.message });
    }
    setProcessing(null);
  }

  function initiateDeleteUser(userId) {
    const user = users.find(u => u.id === userId);
    setConfirmModal({ type: "user", id: userId, name: user?.full_name || user?.email, typedName: "" });
  }

  async function confirmDeleteUser() {
    const { id: userId, name } = confirmModal;
    setConfirmModal(null);
    setProcessing(userId);
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (!error) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      setFeedback({ type: "success", msg: `${name} removed` });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: "error", msg: "Failed to remove: " + error.message });
    }
    setProcessing(null);
  }

  async function updateUserRole(userId, newRole) {
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    if (!error) setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  }

  async function togglePlatformAdmin(userId, current) {
    const { error } = await supabase.from("profiles").update({ platform_admin: !current }).eq("id", userId);
    if (!error) setUsers(prev => prev.map(u => u.id === userId ? { ...u, platform_admin: !current } : u));
  }

  async function deleteInvite(invId) {
    if (!confirm("Delete this invitation?")) return;
    const { error } = await supabase.from("invitations").delete().eq("id", invId);
    if (!error) {
      setInvites(prev => prev.filter(i => i.id !== invId));
      setFeedback({ type: "success", msg: "Invitation deleted." });
      setTimeout(() => setFeedback(null), 2000);
    } else {
      setFeedback({ type: "error", msg: "Failed to delete: " + error.message });
    }
  }

  async function createInvite() {
    if (!newInviteEmail || !newInviteClub) return;
    setProcessing("new-invite");
    const { data, error } = await supabase.from("invitations").insert({
      email: newInviteEmail, club: newInviteClub, role: newInviteRole, invited_by: currentUserId,
    }).select("token").single();
    if (data) {
      const url = `${window.location.origin}/?invite=${data.token}`;
      try {
        await fetch("https://matchgapper-club-notify.tom-54b.workers.dev/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clubName: newInviteClub,
            proName: "",
            proEmail: newInviteEmail.toLowerCase(),
            inviteToken: data.token,
          }),
        });
        setFeedback({ type: "success", msg: `Invite emailed to ${newInviteEmail}! Link: ${url}` });
      } catch (e) {
        console.error("Failed to send invite email:", e);
        setFeedback({ type: "warning", msg: `Invite created but email failed. Share this link manually: ${url}` });
      }
      setNewInviteEmail(""); setNewInviteClub(""); setNewInviteRole("captain");
      loadAll();
    }
    if (error) setFeedback({ type: "error", msg: error.message });
    setProcessing(null);
  }

  const pending = clubs.filter(c => c.status === "pending");
  const approved = clubs.filter(c => c.status === "approved");
  const rejected = clubs.filter(c => c.status === "rejected");
  const totalPlayers = approved.length;

  const sectionBtns = [
    { id: "dashboard", label: "Overview", count: null },
    { id: "clubs", label: "Clubs", count: clubs.length },
    { id: "users", label: "Users", count: users.length },
    { id: "invites", label: "Invitations", count: invites.length },
  ];

  const inputStyle = { padding: "8px 12px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 13, background: "#f5f7fb", outline: "none" };

  return (
    <div>
      {/* Section Navigation */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {sectionBtns.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            style={{ padding: "8px 18px", borderRadius: 8, border: activeSection === s.id ? "2px solid #f59e0b" : "1px solid #c1cad8", background: activeSection === s.id ? "#fef3c7" : "#fff", color: activeSection === s.id ? "#92400e" : "#64748b", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {s.label} {s.count !== null && <span style={{ marginLeft: 4, opacity: 0.7 }}>({s.count})</span>}
          </button>
        ))}
        <button onClick={loadAll} style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 8, border: "1px solid #c1cad8", background: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Refresh</button>
      </div>

      {feedback && (
        <div style={{ background: feedback.type === "error" ? "#fee2e2" : "#dcfce7", color: feedback.type === "error" ? "#991b1b" : "#166534", padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 14, wordBreak: "break-all", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "inherit" }}>x</button>
        </div>
      )}

      {loading ? <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Loading platform data...</div> : (
        <>
          {/* OVERVIEW */}
          {activeSection === "dashboard" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Active Clubs", value: approved.length, color: "#16a34a" },
                  { label: "Pending Clubs", value: pending.length, color: "#f59e0b" },
                  { label: "Total Users", value: users.length, color: "#1e40af" },
                  { label: "Platform Admins", value: users.filter(u => u.platform_admin).length, color: "#7c3aed" },
                  { label: "Active Invites", value: invites.filter(i => !i.used && new Date(i.expires_at) > new Date()).length, color: "#06b6d4" },
                  { label: "Rejected Clubs", value: rejected.length, color: "#dc2626" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", padding: 20, textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 600, color }}>{value}</div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Pending Registrations */}
              {pending.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    Pending Registrations
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#fef3c7", color: "#92400e" }}>{pending.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {pending.map(club => (
                      <div key={club.id} style={{ background: "#fff", borderRadius: 12, border: "2px solid #fbbf24", padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600 }}>{club.name}</div>
                          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>PGA Pro: <strong>{club.pro_name}</strong> · {club.pro_email}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Submitted {new Date(club.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => approveClub(club)} disabled={processing === club.id}
                            style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                            {processing === club.id ? "..." : "Approve & Create Invite"}
                          </button>
                          <button onClick={() => rejectClub(club.id)} disabled={processing === club.id}
                            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff5f5", color: "#dc2626", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Users */}
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Recent Signups</div>
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "hidden" }}>
                  <div className="mg-table-wrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
                    <thead>
                      <tr style={{ background: "linear-gradient(135deg, #0f172a, #162d50)", color: "#f59e0b" }}>
                        {["Name", "Email", "Club", "Role", "Joined"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.slice(0, 10).map((u, i) => (
                        <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#f5f7fb", borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>{u.full_name || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>{u.email}</td>
                          <td style={{ padding: "10px 14px" }}>{u.club || "—"}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: u.platform_admin ? "#fef3c7" : (ROLE_CONFIG[u.role]?.bg || "#f1f5f9"), color: u.platform_admin ? "#92400e" : (ROLE_CONFIG[u.role]?.color || "#64748b") }}>
                              {u.platform_admin ? "Platform Admin" : (ROLE_CONFIG[u.role]?.label || u.role)}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 11 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CLUBS */}
          {activeSection === "clubs" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>All Clubs ({clubs.length})</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "hidden" }}>
                <div className="mg-table-wrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: "linear-gradient(135deg, #0f172a, #162d50)", color: "#f59e0b" }}>
                      {["Club", "PGA Pro", "Email", "Status", "Registered", "Actions"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clubs.map((club, i) => (
                      <tr key={club.id} style={{ background: i % 2 === 0 ? "#fff" : "#f5f7fb", borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>{club.name}</td>
                        <td style={{ padding: "10px 14px" }}>{club.pro_name}</td>
                        <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>{club.pro_email}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "2px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                            background: club.status === "approved" ? "#dcfce7" : club.status === "pending" ? "#fef3c7" : "#fee2e2",
                            color: club.status === "approved" ? "#166534" : club.status === "pending" ? "#92400e" : "#991b1b" }}>
                            {club.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 11 }}>{new Date(club.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                          {club.status === "pending" && (
                            <>
                              <button onClick={() => approveClub(club)} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#16a34a", color: "#fff", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>Approve</button>
                              <button onClick={() => rejectClub(club.id)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff5f5", color: "#dc2626", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>Reject</button>
                            </>
                          )}
                          {club.status === "approved" && (
                            <button onClick={() => onEnterClub(club.name)}
                              style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #7dd3fc", background: "#eff6ff", color: "#1e40af", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                              Enter Club View
                            </button>
                          )}
                          <span style={{ fontSize: 11, color: "#64748b", padding: "4px 8px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                            {playerCounts[club.name] || 0} players
                          </span>
                          <button onClick={() => initiateDeleteClub(club.id)}
                            disabled={processing === club.id}
                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff5f5", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* USERS */}
          {activeSection === "users" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>All Users ({users.length})</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "hidden" }}>
                <div className="mg-table-wrap" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "linear-gradient(135deg, #0f172a, #162d50)", color: "#f59e0b" }}>
                      {["Name", "Email", "Club", "Role", "Platform Admin", "Onboarded", "Actions"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#f5f7fb", borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>{u.full_name || "—"}</td>
                        <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>{u.email}</td>
                        <td style={{ padding: "10px 14px" }}>{u.club || "—"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <select value={u.role} onChange={e => updateUserRole(u.id, e.target.value)}
                            style={{ ...inputStyle, padding: "4px 8px", fontSize: 11 }}>
                            <option value="admin">Admin</option>
                            <option value="captain">Captain</option>
                            <option value="vice_captain">Vice Captain</option>
                          </select>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <input type="checkbox" checked={u.platform_admin || false} onChange={() => togglePlatformAdmin(u.id, u.platform_admin)} style={{ cursor: "pointer", width: 16, height: 16 }} />
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontSize: 11, color: u.onboarded ? "#16a34a" : "#94a3b8" }}>{u.onboarded ? "Yes" : "No"}</span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {u.club && u.club !== "MatchGapper" && (
                              <button onClick={() => onEnterClub(u.club)}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #7dd3fc", background: "#eff6ff", color: "#1e40af", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                                View Club
                              </button>
                            )}
                            {u.id !== currentUserId && (
                              <button onClick={() => initiateDeleteUser(u.id)}
                                disabled={processing === u.id}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff5f5", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* INVITATIONS */}
          {activeSection === "invites" && (
            <div>
              {/* Create new invite */}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Create Invite for Any Club</div>
                <div className="mg-pa-create" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Email</label>
                    <input type="email" value={newInviteEmail} onChange={e => setNewInviteEmail(e.target.value)} placeholder="user@email.com" style={{ ...inputStyle, width: "100%" }} />
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Club</label>
                    <input type="text" value={newInviteClub} onChange={e => setNewInviteClub(e.target.value)} placeholder="Club name" list="all-clubs-list" style={{ ...inputStyle, width: "100%" }} />
                    <datalist id="all-clubs-list">{GAP_CLUBS.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Role</label>
                    <select value={newInviteRole} onChange={e => setNewInviteRole(e.target.value)} style={{ ...inputStyle, padding: "8px 12px" }}>
                      <option value="admin">Admin</option>
                      <option value="captain">Captain</option>
                      <option value="vice_captain">Vice Captain</option>
                    </select>
                  </div>
                  <button onClick={createInvite} disabled={processing === "new-invite"}
                    style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    {processing === "new-invite" ? "..." : "Create Invite"}
                  </button>
                </div>
              </div>

              {/* Invite list */}
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>All Invitations ({invites.length})</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "hidden" }}>
                <div className="mg-table-wrap" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "linear-gradient(135deg, #0f172a, #162d50)", color: "#f59e0b" }}>
                      {["Email", "Club", "Role", "Status", "Created", "Link"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((inv, i) => {
                      const expired = new Date(inv.expires_at) < new Date();
                      const status = inv.used ? "Used" : expired ? "Expired" : "Active";
                      const statusColor = inv.used ? "#16a34a" : expired ? "#94a3b8" : "#f59e0b";
                      const statusBg = inv.used ? "#dcfce7" : expired ? "#f1f5f9" : "#fef3c7";
                      return (
                        <tr key={inv.id} style={{ background: i % 2 === 0 ? "#fff" : "#f5f7fb", borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "10px 14px" }}>{inv.email}</td>
                          <td style={{ padding: "10px 14px" }}>{inv.club}</td>
                          <td style={{ padding: "10px 14px" }}>{ROLE_CONFIG[inv.role]?.label || inv.role}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ padding: "2px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: statusBg, color: statusColor }}>{status}</span>
                          </td>
                          <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 11 }}>{new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                          <td style={{ padding: "10px 14px", display: "flex", gap: 4 }}>
                            {!inv.used && !expired && (
                              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?invite=${inv.token}`); setFeedback({ type: "success", msg: "Invite link copied!" }); setTimeout(() => setFeedback(null), 2000); }}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #c1cad8", background: "#f8fafc", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                                Copy Link
                              </button>
                            )}
                            <button onClick={() => deleteInvite(inv.id)}
                              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff5f5", color: "#dc2626", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {confirmModal && ReactDOM.createPortal(
        <div onClick={() => setConfirmModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 28, width: 380, maxWidth: "92vw", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>⚠️</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>Permanently delete {confirmModal.type === "club" ? "club" : "user"}?</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>This action cannot be undone.</div>
              </div>
            </div>
            {confirmModal.type === "club" && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>{confirmModal.name}</div>
                <div style={{ color: "#dc2626" }}>This will permanently delete <strong>{confirmModal.playerCount} players</strong>, all invitations, and the club record.</div>
              </div>
            )}
            {confirmModal.type === "user" && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>
                <strong>{confirmModal.name}</strong>'s profile will be permanently removed.
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Type <strong>{confirmModal.name}</strong> to confirm:</div>
              <input autoFocus value={confirmModal.typedName}
                onChange={e => setConfirmModal(prev => ({ ...prev, typedName: e.target.value }))}
                placeholder={confirmModal.name}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button disabled={confirmModal.typedName !== confirmModal.name}
                onClick={confirmModal.type === "club" ? confirmDeleteClub : confirmDeleteUser}
                style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: confirmModal.typedName === confirmModal.name ? "#dc2626" : "#fca5a5", color: "#fff", fontWeight: 700, fontSize: 13, cursor: confirmModal.typedName === confirmModal.name ? "pointer" : "not-allowed", transition: "background 0.15s" }}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export { IconPlatform };
export default PlatformAdmin;
