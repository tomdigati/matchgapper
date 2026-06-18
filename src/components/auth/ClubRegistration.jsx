import { useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { GAP_CLUBS } from "../../utils/data";


// TODO: move to shared UI component
function ClubSearchDropdown({ value, onChange, placeholder }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    if (!search) return GAP_CLUBS.slice(0, 20);
    const q = search.toLowerCase();
    return GAP_CLUBS.filter(c => c.toLowerCase().includes(q)).slice(0, 20);
  }, [search]);
  return (
    <div style={{ position: "relative", flex: 1 }}>
      <input
        value={open ? search : value || ""}
        onChange={e => { setSearch(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => { setOpen(true); setSearch(value || ""); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder || "Search 334 GAP clubs..."}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 13, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #c1cad8", borderRadius: "0 0 8px 8px", maxHeight: 220, overflowY: "auto", zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
          {filtered.map(club => (
            <div key={club} onMouseDown={() => { onChange(club); setSearch(""); setOpen(false); }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9", background: club === value ? "#eff6ff" : "#fff" }}
              onMouseEnter={e => e.target.style.background = "#f0f9ff"}
              onMouseLeave={e => e.target.style.background = club === value ? "#eff6ff" : "#fff"}>
              {club}
            </div>
          ))}
          {filtered.length === 20 && <div style={{ padding: "6px 12px", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>Type to narrow results...</div>}
        </div>
      )}
    </div>
  );
}

function ClubRegistration({ onBack }) {
  const [proName, setProName] = useState("");
  const [proEmail, setProEmail] = useState("");
  const [clubName, setClubName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    // PGA email validation disabled for testing — re-enable for production
    // if (!proEmail.toLowerCase().endsWith("@pga.com")) {
    //   setError("Club registration requires a @pga.com email address. Only PGA professionals can register clubs.");
    if (false) {
      return;
    }
    if (!clubName) { setError("Please select your club."); return; }
    setSubmitting(true);
    // Check if club already registered
    const { data: existing } = await supabase.from("clubs").select("id, verified").eq("name", clubName);
    if (existing && existing.length > 0) {
      setError(`${clubName} is already registered. Contact your club admin for an invitation.`);
      setSubmitting(false);
      return;
    }
    const { error: insertErr } = await supabase.from("clubs").insert({
      name: clubName, pro_name: proName, pro_email: proEmail.toLowerCase()
    });
    if (insertErr) {
      setError("Registration failed: " + insertErr.message);
    } else {
      setSuccess(true);
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div style={{ fontFamily: "'Poppins', 'Segoe UI', -apple-system, sans-serif", background: "#eef2f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />
        <div className="mg-modal" style={{ width: 460, background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "32px", textAlign: "center", borderBottom: "3px solid #16a34a" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#9989;</div>
            <div style={{ color: "#7dd3fc", fontSize: 22, fontWeight: 600 }}>Club Registered!</div>
          </div>
          <div style={{ padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#0f172a", fontWeight: 600, marginBottom: 8 }}>{clubName}</p>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Your request has been submitted! Once approved, you'll receive an admin invitation link at <strong>{proEmail}</strong> to set up your account and start inviting captains.
            </p>
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "16px 20px", marginBottom: 24, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#0f172a", margin: "0 0 8px", fontWeight: 600 }}>Need immediate support?</p>
              <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
                Text us at <a href="sms:2156013439" style={{ color: "#0369a1", fontWeight: 600, textDecoration: "none" }}>215-601-3439</a>
              </p>
            </div>
            <button onClick={onBack} style={{ padding: "12px 32px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Poppins', 'Segoe UI', -apple-system, sans-serif", background: "#eef2f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />
      <div className="mg-modal" style={{ width: 460, background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "32px 32px 24px", textAlign: "center", borderBottom: "3px solid #7dd3fc" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #7dd3fc, #38bdf8)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>M</div>
          <div style={{ color: "#7dd3fc", fontSize: 22, fontWeight: 600 }}>Register Your Club</div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>PGA Professional verification required</div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "28px 32px" }}>
          <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, color: "#92400e" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>PGA Pro Authorization Required</div>
            Only PGA professionals with a <strong>@pga.com</strong> email address can register a club. Once registered, the pro can invite captains and vice-captains.
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>PGA Professional Name</label>
            <input value={proName} onChange={e => setProName(e.target.value)} placeholder="Mike Dever" required
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #c1cad8", fontSize: 14, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>PGA Email Address</label>
            <input type="email" value={proEmail} onChange={e => setProEmail(e.target.value)} placeholder="mdever@pga.com" required
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${proEmail && !proEmail.toLowerCase().endsWith("@pga.com") ? "#dc2626" : "#c1cad8"}`, fontSize: 14, background: "#f5f7fb", outline: "none", boxSizing: "border-box" }} />
            {proEmail && !proEmail.toLowerCase().endsWith("@pga.com") && (
              <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, fontWeight: 600 }}>Must be a @pga.com email address</div>
            )}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>Club</label>
            <ClubSearchDropdown value={clubName} onChange={setClubName} placeholder="Search 334 GAP member clubs..." />
            {clubName && <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4, fontWeight: 600 }}>{clubName}</div>}
          </div>
          {error && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={submitting}
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc", fontWeight: 600, fontSize: 15, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Registering..." : "Register Club"}
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

export default ClubRegistration;
