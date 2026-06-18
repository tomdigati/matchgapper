import { useState, useMemo } from "react";
import { GAP_CLUBS } from "../../utils/data";

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

export default ClubSearchDropdown;
