"use client";

import { useId } from "react";

export default function LineChart({ data = [], height = 160 }) {
  if (!data.length) {
    return <p>No data available.</p>;
  }

  const gradientId = useId();
  const areaId = useId();
  const padding = 24;
  const width = 560;
  const values = data.map((point) => point.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const range = max - min || 1;

  const coordinates = data.map((point, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * (width - padding * 2);
    const y = padding + ((max - point.value) / range) * (height - padding * 2);
    return { x, y };
  });

  const points = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = `M ${coordinates[0].x},${coordinates[0].y} ` +
    coordinates.slice(1).map((point) => `L ${point.x},${point.y}`).join(" ") +
    ` L ${coordinates[coordinates.length - 1].x},${height - padding} L ${coordinates[0].x},${height - padding} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id={areaId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(14, 165, 233, 0.2)" />
          <stop offset="100%" stopColor="rgba(168, 85, 247, 0.08)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="#f8fafc" rx="10" />
      <path d={areaPath} fill={`url(#${areaId})`} />
      <polyline
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3.5"
        points={points}
      />
      {data.map((point, index) => {
        const { x, y } = coordinates[index];
        return (
          <circle key={point.label} cx={x} cy={y} r="4" fill="#1d4ed8" stroke="#ffffff" strokeWidth="1.5">
            <title>{`${point.label}: ${point.value}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}
