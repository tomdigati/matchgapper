export function StatCard({ value, label, color = "#0f172a", subtitle }) {
  return (
    <div
      className="mg-stat-card"
      style={{
        background: "#fff",
        borderRadius: 10,
        padding: "14px 12px",
        border: "1px solid #d1d9e6",
        textAlign: "center",
      }}
    >
      <div className="stat-num" style={{ fontSize: 26, fontWeight: 600, color }}>
        {value}
      </div>
      <div
        className="stat-label"
        style={{
          fontSize: 10,
          color: "#64748b",
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {subtitle && (
        <div className="stat-sub" style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
