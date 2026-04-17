export function ProgressBar({ percent = 0, color = "#38bdf8", height = 8 }) {
  return (
    <div
      style={{
        background: "#e2e8f0",
        borderRadius: 99,
        height,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, percent * 100))}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
          transition: "width 0.5s ease",
        }}
      />
    </div>
  );
}
