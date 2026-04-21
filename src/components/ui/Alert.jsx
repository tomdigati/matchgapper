export function Alert({ type = "success", msg, onClose }) {
  if (!msg) return null;
  const isError = type === "error";
  const isWarning = type === "warning";
  return (
    <div
      style={{
        background: isError ? "#fee2e2" : isWarning ? "#fef3c7" : "#dcfce7",
        color: isError ? "#991b1b" : isWarning ? "#92400e" : "#166534",
        padding: "10px 16px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 14,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>{msg}</span>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            color: "inherit",
            padding: "0 4px",
          }}
        >
          x
        </button>
      )}
    </div>
  );
}
