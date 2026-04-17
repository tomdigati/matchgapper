export const fmtH = (h) => Number(h).toFixed(1);

export const fmtDate = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const dt = new Date(+y, +m - 1, +day);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const fmtDateLong = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const dt = new Date(+y, +m - 1, +day);
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export const addMinutes = (timeStr, mins) => {
  if (!timeStr || !mins) return timeStr;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return timeStr;
  let [, h, m, ampm] = match;
  let hours = parseInt(h);
  let minutes = parseInt(m);
  if (ampm.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
  const total = hours * 60 + minutes + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  const newAmpm = nh >= 12 ? "PM" : "AM";
  const displayH = nh > 12 ? nh - 12 : nh === 0 ? 12 : nh;
  return `${displayH}:${nm.toString().padStart(2, "0")} ${newAmpm}`;
};
