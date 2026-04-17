import { useState } from "react";

export function PasswordInput({ value, onChange, placeholder = "Password", style = {} }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        style={{
          width: "100%",
          padding: "10px 40px 10px 14px",
          borderRadius: 8,
          border: "1px solid #c1cad8",
          fontSize: 14,
          background: "#f5f7fb",
          outline: "none",
          boxSizing: "border-box",
          ...style,
        }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 16,
          color: "#64748b",
        }}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
