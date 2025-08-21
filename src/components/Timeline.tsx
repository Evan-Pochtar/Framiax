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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Show preview time on hover
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const previewTime = duration * ratio;
    
    // Update tooltip position (handled via CSS)
    e.currentTarget.style.setProperty('--preview-time', `"${Math.floor(previewTime / 60)}:${(previewTime % 60).toFixed(1).padStart(4, '0')}"`);
    e.currentTarget.style.setProperty('--preview-left', `${e.clientX - rect.left}px`);
  };

  const percent = (current / duration) * 100 || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Time Labels */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#888" }}>
        <span>0:00</span>
        <span>{Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}</span>
      </div>
      
      {/* Main Timeline */}
      <div
        style={{
          position: "relative",
          height: "32px",
          background: "#333",
          borderRadius: "16px",
          cursor: "pointer",
          border: "2px solid var(--border)",
          overflow: "hidden",
        }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={(e) => e.currentTarget.style.removeProperty('--preview-time')}
      >
        {/* Annotation Highlights */}
        {annotations.map((a) => {
          const start = (a.timestamp / duration) * 100;
          const end = ((a.timestamp + a.duration) / duration) * 100;
          return (
            <div
              key={a.id}
              style={{
                position: "absolute",
                left: `${start}%`,
                width: `${Math.max(end - start, 0.5)}%`,
                top: "6px",
                bottom: "6px",
                background: a.type === "text" ? "var(--accent2)" : "#4caf50",
                opacity: 0.7,
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
              title={`${a.type} at ${a.timestamp.toFixed(1)}s`}
            />
          );
        })}
        
        {/* Progress Bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            width: `${percent}%`,
            top: 0,
            bottom: 0,
            background: "linear-gradient(90deg, var(--accent), #00bcd4)",
            borderRadius: "16px",
            transition: "width 0.1s ease",
          }}
        />
        
        {/* Progress Handle */}
        <div
          style={{
            position: "absolute",
            left: `${percent}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "20px",
            height: "20px",
            background: "#fff",
            borderRadius: "50%",
            border: "2px solid var(--accent)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            pointerEvents: "none",
          }}
        />
        
        {/* Hover Preview */}
        <div
          style={{
            position: "absolute",
            top: "-30px",
            left: "var(--preview-left, -100px)",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            pointerEvents: "none",
            opacity: "var(--preview-time) ? 1 : 0",
            transition: "opacity 0.2s ease",
            whiteSpace: "nowrap",
          }}
        >
          {/* Content will be set via CSS custom property */}
        </div>
      </div>
      
      {/* Quick Navigation */}
      <div style={{ display: "flex", justifyContent: "center", gap: "4px" }}>
        <button 
          onClick={() => onSeek(Math.max(0, current - 10))}
          style={{ padding: "2px 6px", fontSize: "12px" }}
          title="Back 10s"
        >
          ⏪
        </button>
        <button 
          onClick={() => onSeek(Math.max(0, current - 1))}
          style={{ padding: "2px 6px", fontSize: "12px" }}
          title="Back 1s"
        >
          ⏮
        </button>
        <button 
          onClick={() => onSeek(Math.min(duration, current + 1))}
          style={{ padding: "2px 6px", fontSize: "12px" }}
          title="Forward 1s"
        >
          ⏭
        </button>
        <button 
          onClick={() => onSeek(Math.min(duration, current + 10))}
          style={{ padding: "2px 6px", fontSize: "12px" }}
          title="Forward 10s"
        >
          ⏩
        </button>
      </div>
    </div>
  );
}
