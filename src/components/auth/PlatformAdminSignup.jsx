import { useState } from "react";
import { isPlatformAdminEmail } from "../../utils/constants";

function PlatformAdminSignup({ onSignUp, onBack }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!isPlatformAdminEmail(email)) {
      setError("This email is not authorized for platform admin access.");
      return;
    }
    if (password !== confirmPw) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    const { error } = await onSignUp(email, password, fullName, "admin", "MatchGapper");
    if (error) { setError(error.message); setSubmitting(false); }
    else { setSuccess(true); setSubmitting(false); }
  };

  if (success) {
    return (
      <div style={{ fontFamily: "'Poppins', sans-serif", background: "#eef2f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />
        <div className="mg-modal" style={{ width: 420, background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden", textAlign: "center" }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "32px 32px 24px", borderBottom: "3px solid #f59e0b" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", marginBottom: 12 }}>&#9889;</div>
            <div style={{ color: "#f59e0b", fontSize: 20, fontWeight: 600 }}>Account Created!</div>
          </div>
          <div style={{ padding: "32px" }}>
            <p style={{ fontSize: 14, color: "#475569", marginBottom: 16 }}>Check your email for a confirmation link, then sign in.</p>
            <button onClick={onBack} style={{ padding: "12px 32px", borderRadius: 8, border: "none", background: "#0f172a", color: "#f59e0b", fontWeight: 600, cursor: "pointer" }}>Back to Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: "#eef2f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />
      <div className="mg-modal" style={{ width: 420, background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "32px 32px 24px", textAlign: "center", borderBottom: "3px solid #f59e0b" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", marginBottom: 12 }}>&#9889;</div>
          <div style={{ color: "#f59e0b", fontSize: 20, fontWeight: 600 }}>Platform Admin</div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>System administrator access</div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "24px 32px" }}>
          <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, padding: 12, marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>Restricted Access</div>
            <div style={{ fontSize: 11, color: "#a16207", marginTop: 2 }}>Only authorized Axiolo team members can create platform admin accounts.</div>
          </div>
          {[
            { label: "Full Name", value: fullName, setter: setFullName, type: "text", ph: "Your name" },
            { label: "Email", value: email, setter: setEmail, type: "email", ph: "you@axiolo.com" },
          ].map(({ label, value, setter, type, ph }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>{label}</label>
              <input type={type} value={value} onChange={e => setter(e.target.value)} placeholder={ph} required
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 14, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6}
                style={{ width: "100%", padding: "10px 14px", paddingRight: 60, borderRadius: 8, border: "1px solid #c1cad8", fontSize: 14, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", padding: "4px 8px", borderRadius: 4, border: "none", background: showPw ? "#0f172a" : "#e2e8f0", color: showPw ? "#f59e0b" : "#64748b", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                {showPw ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Confirm Password</label>
            <input type={showPw ? "text" : "password"} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm password" required minLength={6}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 14, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }} />
          </div>
          {error && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={submitting}
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", fontWeight: 600, fontSize: 15, cursor: submitting ? "wait" : "pointer" }}>
            {submitting ? "Creating..." : "Create Platform Admin Account"}
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

export default PlatformAdminSignup;
