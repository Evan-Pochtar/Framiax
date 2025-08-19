import React from "react";
import { Annotation } from "../types";

type Props = {
  duration: number;
  current: number;
  onSeek: (t: number) => void;
  annotations: Annotation[];
};

export default function Timeline({ duration, current, onSeek, annotations }: Props) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(duration * ratio);
  };

  const percent = (current / duration) * 100 || 0;

  return (
    <div
      style={{
        position: "relative",
        height: "14px",
        background: "#333",
        borderRadius: "7px",
        cursor: "pointer",
      }}
      onClick={handleClick}
    >
      {/* Highlights */}
      {annotations.map((a) => {
        const start = (a.timestamp / duration) * 100;
        const end = ((a.timestamp + a.duration) / duration) * 100;
        return (
          <div
            key={a.id}
            style={{
              position: "absolute",
              left: `${start}%`,
              width: `${Math.max(end - start, 1)}%`,
              top: 0,
              bottom: 0,
              background: "var(--accent2)",
              opacity: 0.6,
            }}
          />
        );
      })}
      {/* Progress */}
      <div
        style={{
          position: "absolute",
          left: 0,
          width: `${percent}%`,
          top: 0,
          bottom: 0,
          background: "var(--accent)",
          borderRadius: "7px",
        }}
      />
    </div>
  );
}
