export default function ScoreGauge({ score }) {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const angle = (safeScore / 100) * 180;
  const color = safeScore < 40 ? "#b91c1c" : safeScore < 70 ? "#b45309" : "#15803d";

  return (
    <div style={{ display: "inline-block", textAlign: "center" }}>
      <svg width="220" height="120" viewBox="0 0 220 120">
        <path d="M10,110 A100,100 0 0,1 210,110" fill="none" stroke="#e5e7eb" strokeWidth="14" />
        <path
          d="M10,110 A100,100 0 0,1 210,110"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeDasharray={`${(safeScore / 100) * 314} 314`}
        />
        <line
          x1="110"
          y1="110"
          x2={110 + 85 * Math.cos(((180 - angle) * Math.PI) / 180)}
          y2={110 - 85 * Math.sin(((180 - angle) * Math.PI) / 180)}
          stroke="#111827"
          strokeWidth="4"
        />
        <circle cx="110" cy="110" r="6" fill="#111827" />
      </svg>
      <div style={{ fontSize: "2rem", fontWeight: 700, color }}>{safeScore}</div>
    </div>
  );
}
