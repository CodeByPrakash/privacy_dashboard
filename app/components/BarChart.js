"use client";

export default function BarChart({ data = [], height = 160 }) {
  if (!data.length) {
    return <p>No data available.</p>;
  }

  const padding = 24;
  const width = 560;
  const max = Math.max(...data.map((point) => point.value), 1);
  const barWidth = (width - padding * 2) / data.length - 6;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} fill="#f8fafc" rx="10" />
      {data.map((point, index) => {
        const x = padding + index * ((width - padding * 2) / data.length) + 3;
        const barHeight = ((point.value || 0) / max) * (height - padding * 2);
        const y = height - padding - barHeight;
        return (
          <g key={point.label}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill="#f59e0b" rx="4" />
            <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="#64748b">
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
