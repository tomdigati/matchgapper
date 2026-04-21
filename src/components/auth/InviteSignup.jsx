import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { ROLE_CONFIG } from "../../utils/constants";

function InviteSignup({ invite, onSignUp, onBack }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(invite.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: invite.role, club: invite.club, invite_token: invite.token } }
    });
    if (signUpErr) {
      setError(signUpErr.message);
    } else if (data?.user) {
      await supabase.from("profiles").update({ role: invite.role, club: invite.club }).eq("id", data.user.id);
      // Mark invitation used
      await supabase.from("invitations").update({ used: true, used_by: data.user.id }).eq("token", invite.token);
      setMessage("Account created! Check your email for a confirmation link.");
    }
    setSubmitting(false);
  };

  return (
    <div style={{ fontFamily: "'Poppins', 'Segoe UI', -apple-system, sans-serif", background: "#eef2f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />
      <div className="mg-modal" style={{ width: 420, background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "32px 32px 24px", textAlign: "center", borderBottom: "3px solid #16a34a" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #7dd3fc, #38bdf8)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>M</div>
          <div style={{ color: "#7dd3fc", fontSize: 22, fontWeight: 600 }}>You're Invited!</div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>Join {invite.club} on MatchGapper</div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "28px 32px" }}>
          <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Club</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{invite.club}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Role</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{ROLE_CONFIG[invite.role]?.label || invite.role}</div>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Smith" required
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 14, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 14, background: invite.email ? "#e2e8f0" : "#f5f7fb", outline: "none", boxSizing: "border-box" }}
              readOnly={!!invite.email} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6}
                style={{ width: "100%", padding: "10px 14px", paddingRight: 60, borderRadius: 8, border: "1px solid #c1cad8", fontSize: 14, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", padding: "4px 8px", borderRadius: 4, border: "none", background: showPassword ? "#0f172a" : "#e2e8f0", color: showPassword ? "#7dd3fc" : "#64748b", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Confirm Password</label>
            <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" required minLength={6}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${confirmPassword && confirmPassword !== password ? "#dc2626" : "#c1cad8"}`, fontSize: 14, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }} />
            {confirmPassword && confirmPassword !== password && (
              <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, fontWeight: 600 }}>Passwords do not match</div>
            )}
          </div>
          {error && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
          {message && <div style={{ background: "#dcfce7", color: "#166534", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{message}</div>}
          <button type="submit" disabled={submitting || !!message}
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc", fontWeight: 600, fontSize: 15, cursor: submitting ? "wait" : "pointer", opacity: submitting || message ? 0.7 : 1 }}>
            {submitting ? "Creating Account..." : "Create Account"}
          </button>
          <button type="button" onClick={onBack}
            style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #c1cad8", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", marginTop: 10 }}>
            Back to Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default InviteSignup;
