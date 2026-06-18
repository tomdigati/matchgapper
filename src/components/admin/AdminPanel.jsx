import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { ROLE_CONFIG, ACCENT } from "../../utils/constants";

function AdminPanel({ currentUserId, clubName }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [inviteTab, setInviteTab] = useState("users");
  const [invites, setInvites] = useState([]);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteRole, setNewInviteRole] = useState("vice_captain");
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    loadUsers();
    loadInvites();
  }, []);

  async function loadInvites() {
    const { data } = await supabase.from("invitations").select("*").eq("club", clubName).order("created_at", { ascending: false });
    if (data) setInvites(data);
  }

  async function sendInvite() {
    if (!newInviteEmail) return;
    setSendingInvite(true);
    setFeedback(null);
    const { data, error } = await supabase.from("invitations").insert({
      email: newInviteEmail.toLowerCase(),
      club: clubName,
      role: newInviteRole,
      invited_by: currentUserId,
    }).select("*").single();
    if (error) {
      setFeedback({ type: "error", msg: "Failed to create invite: " + error.message });
    } else {
      setInvites(prev => [data, ...prev]);
      const inviteUrl = `${window.location.origin}/?invite=${data.token}`;
      try {
        await fetch("https://matchgapper-club-notify.tom-54b.workers.dev/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clubName: clubName,
            proName: "",
            proEmail: newInviteEmail.toLowerCase(),
            inviteToken: data.token,
          }),
        });
        setFeedback({ type: "success", msg: `Invite emailed to ${newInviteEmail}! Link: ${inviteUrl}` });
      } catch (e) {
        console.error("Failed to send invite email:", e);
        setFeedback({ type: "warning", msg: `Invite created but email failed. Share this link manually: ${inviteUrl}` });
      }
      setNewInviteEmail("");
    }
    setSendingInvite(false);
  }

  async function loadUsers() {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("club", clubName)
      .order("created_at", { ascending: true });
    if (data) setUsers(data);
    if (error) setFeedback({ type: "error", msg: "Failed to load users: " + error.message });
    setLoadingUsers(false);
  }

  async function updateRole(userId, newRole) {
    setSaving(userId);
    setFeedback(null);
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) {
      setFeedback({ type: "error", msg: "Failed to update: " + error.message });
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      const user = users.find(u => u.id === userId);
      setFeedback({ type: "success", msg: `${user?.full_name || user?.email} updated to ${ROLE_CONFIG[newRole]?.label || newRole}` });
      setTimeout(() => setFeedback(null), 3000);
    }
    setSaving(null);
  }

  async function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!window.confirm(`Remove ${user?.full_name || user?.email}? This will delete their profile. They would need to sign up again.`)) return;
    setSaving(userId);
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) {
      setFeedback({ type: "error", msg: "Failed to remove: " + error.message });
    } else {
      setUsers(prev => prev.filter(u => u.id !== userId));
      setFeedback({ type: "success", msg: `${user?.full_name || user?.email} removed` });
      setTimeout(() => setFeedback(null), 3000);
    }
    setSaving(null);
  }

  const roleOptions = [
    { value: "admin", label: "Admin", color: "#16a34a", bg: "#dcfce7" },
    { value: "captain", label: "Captain", color: "#1e40af", bg: "#dbeafe" },
    { value: "vice_captain", label: "Vice Captain", color: "#f59e0b", bg: "#fef3c7" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#0f172a" }}>Admin Panel</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Manage users, roles, and invitations</p>
        </div>
        <button onClick={() => { loadUsers(); loadInvites(); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #c1cad8", background: "#fff", color: "#0f172a", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Refresh</button>
      </div>

      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, background: "#f1f5f9", borderRadius: 8, padding: 3, maxWidth: 300 }}>
        <button onClick={() => setInviteTab("users")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: inviteTab === "users" ? "#0f172a" : "transparent", color: inviteTab === "users" ? "#7dd3fc" : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Users</button>
        <button onClick={() => setInviteTab("invites")} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: inviteTab === "invites" ? "#0f172a" : "transparent", color: inviteTab === "invites" ? "#7dd3fc" : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Invitations</button>
      </div>

      {feedback && (
        <div style={{ background: feedback.type === "error" ? "#fee2e2" : "#dcfce7", color: feedback.type === "error" ? "#991b1b" : "#166534", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{feedback.msg}</div>
      )}

      {inviteTab === "users" && (
        loadingUsers ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b", fontSize: 14 }}>Loading users...</div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "hidden" }}>
            <div className="mg-table-wrap" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "linear-gradient(135deg, #0f172a 0%, #162d50 100%)", color: ACCENT }}>
                    {["Name", "Email", "Role", "Joined", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.vice_captain;
                    const isCurrentUser = u.id === currentUserId;
                    const joinDate = u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
                    return (
                      <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#f5f7fb", borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {u.full_name || "—"}
                            {isCurrentUser && <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "#e0f2fe", color: "#0369a1" }}>YOU</span>}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 12 }}>{u.email}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            {roleOptions.map(r => (
                              <button key={r.value} onClick={() => updateRole(u.id, r.value)}
                                disabled={saving === u.id || (isCurrentUser && r.value !== "admin")}
                                style={{
                                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: saving === u.id ? "wait" : "pointer",
                                  border: u.role === r.value ? `2px solid ${r.color}` : "1px solid #e2e8f0",
                                  background: u.role === r.value ? r.bg : "#f8fafc",
                                  color: u.role === r.value ? r.color : "#94a3b8",
                                  opacity: (isCurrentUser && r.value !== "admin") ? 0.4 : 1,
                                  transition: "all 0.15s",
                                }}>
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 11 }}>{joinDate}</td>
                        <td style={{ padding: "12px 16px" }}>
                          {!isCurrentUser && (
                            <button onClick={() => deleteUser(u.id)}
                              disabled={saving === u.id}
                              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff5f5", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px 16px", background: "#f5f7fb", borderTop: "1px solid #e2e8f0", fontSize: 11, color: "#64748b" }}>
              {users.length} user{users.length !== 1 ? "s" : ""} registered
            </div>
          </div>
        )
      )}

      {inviteTab === "invites" && (
        <div>
          {/* Send invite form */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>Send Invitation</div>
            <div className="mg-pa-create" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Email Address</label>
                <input type="email" value={newInviteEmail} onChange={e => setNewInviteEmail(e.target.value)} placeholder="captain@email.com"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: "0 0 160px" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Role</label>
                <select value={newInviteRole} onChange={e => setNewInviteRole(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #c1cad8", fontSize: 13, background: "#f5f7fb", cursor: "pointer" }}>
                  <option value="captain">Captain</option>
                  <option value="vice_captain">Vice Captain</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button onClick={sendInvite} disabled={sendingInvite || !newInviteEmail}
                style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc", fontWeight: 600, fontSize: 13, cursor: sendingInvite ? "wait" : "pointer", opacity: sendingInvite || !newInviteEmail ? 0.6 : 1 }}>
                {sendingInvite ? "Sending..." : "Send Invite"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Invitations expire after 7 days. The recipient will use the link to create their account.</div>
          </div>

          {/* Invite list */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d1d9e6", overflow: "hidden" }}>
            <div className="mg-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #0f172a 0%, #162d50 100%)", color: ACCENT }}>
                  {["Email", "Role", "Status", "Created", "Link"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invites.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No invitations sent yet</td></tr>
                ) : invites.map((inv, i) => {
                  const expired = new Date(inv.expires_at) < new Date();
                  const status = inv.used ? "Used" : expired ? "Expired" : "Pending";
                  const statusColor = inv.used ? "#16a34a" : expired ? "#dc2626" : "#f59e0b";
                  const statusBg = inv.used ? "#dcfce7" : expired ? "#fee2e2" : "#fef3c7";
                  const inviteUrl = `${window.location.origin}/?invite=${inv.token}`;
                  return (
                    <tr key={inv.id} style={{ background: i % 2 === 0 ? "#fff" : "#f5f7fb", borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{inv.email}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: (ROLE_CONFIG[inv.role] || ROLE_CONFIG.vice_captain).bg, color: (ROLE_CONFIG[inv.role] || ROLE_CONFIG.vice_captain).color }}>
                          {(ROLE_CONFIG[inv.role] || ROLE_CONFIG.vice_captain).label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: statusBg, color: statusColor }}>{status}</span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 11 }}>
                        {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {!inv.used && !expired && (
                          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setFeedback({ type: "success", msg: "Invite link copied!" }); setTimeout(() => setFeedback(null), 3000); }}
                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #c1cad8", background: "#f8fafc", color: "#0f172a", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            Copy Link
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <div style={{ padding: "12px 16px", background: "#f5f7fb", borderTop: "1px solid #e2e8f0", fontSize: 11, color: "#64748b" }}>
              {invites.length} invitation{invites.length !== 1 ? "s" : ""} total
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
