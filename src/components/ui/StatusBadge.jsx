import { STATUS_CONFIG } from "../../utils/constants";

export function StatusBadge({ status, size = "sm" }) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  const fontSize = size === "sm" ? 10 : 12;
  const padding = size === "sm" ? "2px 8px" : "3px 10px";
  return (
    <span
      style={{
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: 6,
        background: config.bg,
        color: config.color,
        whiteSpace: "nowrap",
      }}
    >
      {config.label}
    </span>
  );
}
