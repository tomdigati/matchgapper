export function parseName(fullName) {
  const parts = (fullName || "").split(",");
  return {
    last: (parts[0] || "").trim(),
    first: (parts[1] || "").trim(),
  };
}
