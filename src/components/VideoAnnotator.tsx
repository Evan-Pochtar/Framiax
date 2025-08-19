import React, { useRef, useState, useEffect } from "react";
import { Annotation, Stroke, TextNote, ExportPayload } from "../types";
import { uid, simplify, clamp } from "../utils";
import Timeline from "./Timeline";

export default function VideoAnnotator() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [mode, setMode] = useState<"none" | "draw" | "text">("none");
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState("#ffdd00");
  const [width, setWidth] = useState(3);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.addEventListener("timeupdate", () => setCurrentTime(v.currentTime));
    v.addEventListener("loadedmetadata", () => setDuration(v.duration));
  }, []);

  useEffect(() => {
    render();
  }, [annotations, currentTime, currentStroke]);

  function render() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const ctx = c.getContext("2d")!;
    c.width = v.clientWidth;
    c.height = v.clientHeight;
    ctx.clearRect(0, 0, c.width, c.height);
    const t = v.currentTime;

    annotations.forEach((a) => {
      if (t < a.timestamp || t > a.timestamp + a.duration) return;
      if (a.type === "stroke") {
        ctx.beginPath();
        ctx.lineWidth = a.width;
        ctx.strokeStyle = a.color;
        const pts = a.points;
        ctx.moveTo(pts[0].x * c.width, pts[0].y * c.height);
        pts.slice(1).forEach((p) => ctx.lineTo(p.x * c.width, p.y * c.height));
        ctx.stroke();
      } else {
        ctx.fillStyle = a.color;
        ctx.font = "18px sans-serif";
        ctx.fillText(a.text, a.x * c.width, a.y * c.height);
      }
    });

    if (currentStroke) {
      ctx.beginPath();
      ctx.lineWidth = currentStroke.width;
      ctx.strokeStyle = currentStroke.color;
      const pts = currentStroke.points;
      ctx.moveTo(pts[0].x * c.width, pts[0].y * c.height);
      pts.slice(1).forEach((p) => ctx.lineTo(p.x * c.width, p.y * c.height));
      ctx.stroke();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    videoRef.current!.src = url;
    setAnnotations([]);
  }

  function norm(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left) / rect.width),
      y: clamp((e.clientY - rect.top) / rect.height),
    };
  }

  function down(e: React.PointerEvent) {
    if (mode !== "draw") return;
    const p = norm(e);
    const s: Stroke = {
      id: uid("s"),
      type: "stroke",
      timestamp: videoRef.current!.currentTime,
      duration: 2,
      points: [p],
      color,
      width,
    };
    setCurrentStroke(s);
  }
  function move(e: React.PointerEvent) {
    if (!currentStroke) return;
    setCurrentStroke((s) => (s ? { ...s, points: [...s.points, norm(e)] } : s));
  }
  function up() {
    if (!currentStroke) return;
    const simp = simplify(currentStroke.points, 0.003);
    setAnnotations((a) => [...a, { ...currentStroke, points: simp }]);
    setCurrentStroke(null);
  }

  function addText() {
    const txt = prompt("Enter text");
    if (!txt) return;
    const note: TextNote = {
      id: uid("t"),
      type: "text",
      timestamp: videoRef.current!.currentTime,
      duration: 2,
      x: 0.5,
      y: 0.1,
      text: txt,
      color,
    };
    setAnnotations((a) => [...a, note]);
  }

  function exportJSON() {
    const payload: ExportPayload = {
      createdAt: new Date().toISOString(),
      videoUrl: videoRef.current?.src || null,
      annotations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annotations.json";
    a.click();
  }

  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then((txt) => {
      const data: ExportPayload = JSON.parse(txt);
      setAnnotations(data.annotations);
    });
  }

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={() => fileInputRef.current?.click()}>Load Video</button>
          <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={handleFileChange} />
          <button onClick={() => setMode(mode === "draw" ? "none" : "draw")}>Draw</button>
          <button onClick={addText}>Add Text</button>
          <button onClick={exportJSON}>Export</button>
          <button onClick={() => importInputRef.current?.click()}>Import</button>
          <input ref={importInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={importJSON} />
        </div>

        <div style={{ position: "relative", background: "#000", borderRadius: 8, overflow: "hidden" }}>
          <video ref={videoRef} controls style={{ width: "100%", display: "block" }} />
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0 }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <Timeline duration={duration} current={currentTime} annotations={annotations} onSeek={(t) => (videoRef.current!.currentTime = t)} />
        </div>
      </div>

      <div className="annotation-list">
        {annotations.map((a) => (
          <div key={a.id} style={{ marginBottom: 6 }}>
            <div>{a.type} @ {a.timestamp.toFixed(1)}s</div>
            {a.type === "text" && <div>"{(a as TextNote).text}"</div>}
            <div>
              Duration:
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={a.duration}
                onChange={(e) =>
                  setAnnotations((anns) =>
                    anns.map((x) => (x.id === a.id ? { ...x, duration: parseFloat(e.target.value) } : x))
                  )
                }
              />
              s
            </div>
            <button onClick={() => (videoRef.current!.currentTime = a.timestamp)}>Go</button>
            <button onClick={() => setAnnotations((anns) => anns.filter((x) => x.id !== a.id))}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
