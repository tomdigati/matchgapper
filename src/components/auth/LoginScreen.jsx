import { useState } from "react";

function LoginScreen({ onSignIn, onSignUp, onRegisterClub, onPlatformAdmin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await onSignIn(email, password);
    if (error) setError(error.message);
    setSubmitting(false);
  };

  return (
    <div style={{ fontFamily: "'Poppins', 'Segoe UI', -apple-system, sans-serif", background: "#eef2f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />
      <div className="mg-modal" style={{ width: 420, background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "32px 32px 24px", textAlign: "center", borderBottom: "3px solid #7dd3fc" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #7dd3fc, #38bdf8)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>M</div>
          <div style={{ color: "#7dd3fc", fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>MatchGapper</div>
          <div style={{ color: "#94a3b8", fontSize: 12, letterSpacing: 1, marginTop: 4 }}>BMW GAP TEAM MATCH MANAGER</div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "28px 32px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 16, textAlign: "center" }}>Already Signed Up?</div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 14, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
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
          {error && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={submitting}
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc", fontWeight: 600, fontSize: 15, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1, transition: "opacity 0.2s" }}>
            {submitting ? "Signing In..." : "Sign In"}
          </button>
          <div style={{ border: "2px solid #0f172a", borderRadius: 12, marginTop: 24, padding: "20px", textAlign: "center", background: "#fff" }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#38bdf8", marginBottom: 10 }}>New to MatchGapper?</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Signup is by <strong>invitation only</strong>. Ask your club captain or admin for an invite link.
            </div>
            <button type="button" onClick={onRegisterClub}
              style={{ padding: "12px 24px", borderRadius: 8, border: "2px solid #0f172a", background: "#fff", color: "#0f172a", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              PGA Pro? Register Your Club
            </button>
            <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
              <button type="button" onClick={onPlatformAdmin}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
                System Admin Access
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;
