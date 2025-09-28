import React, { useRef, useState, useEffect } from "react";
import { Annotation, Stroke, TextNote, ExportPayload } from "../types";
import { uid, simplify, clamp } from "../utils";
import Timeline from "./Timeline";
import SettingsMenu from "./SettingsMenu";
import ExportPopup from "./ExportPopup";

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
  const [fontSize, setFontSize] = useState(18);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(
    null,
  );
  const [selectedAnnotations, setSelectedAnnotations] = useState<string[]>([]);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [strokeDuration, setStrokeDuration] = useState<number | string>(2);
  const [copiedAnnotations, setCopiedAnnotations] = useState<Annotation[]>([]);
  const [undoHistory, setUndoHistory] = useState<Annotation[][]>([]);
  const [redoHistory, setRedoHistory] = useState<Annotation[][]>([]);
  const [showExportPopup, setShowExportPopup] = useState(false);

  const saveState = () => {
    setUndoHistory((prev) => [...prev.slice(-19), annotations]);
    setRedoHistory([]);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleTimeUpdate = () => setCurrentTime(v.currentTime);
    const handleLoadedMetadata = () => setDuration(v.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    v.volume = volume;
    v.muted = muted;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      switch (e.key.toLowerCase()) {
        // Volume
        case "arrowup":
          if (!isCtrl) {
            e.preventDefault();
            setVolume((prev) => Math.min(1, prev + 0.1));
          }
          break;
        case "arrowdown":
          if (!isCtrl) {
            e.preventDefault();
            setVolume((prev) => Math.max(0, prev - 0.1));
          }
          break;

        // Seeking
        case "arrowleft":
          e.preventDefault();
          if (v) {
            const seekAmount = isShift ? 10 : isCtrl ? 1 : 5;
            v.currentTime = Math.max(0, v.currentTime - seekAmount);
          }
          break;
        case "arrowright":
          e.preventDefault();
          if (v) {
            const seekAmount = isShift ? 10 : isCtrl ? 1 : 5;
            v.currentTime = Math.min(v.duration, v.currentTime + seekAmount);
          }
          break;

        // Playback
        case " ":
        case "k":
          e.preventDefault();
          togglePlayPause();
          break;
        case "m":
          e.preventDefault();
          setMuted((prev) => !prev);
          break;

        // Mode
        case "d":
          e.preventDefault();
          if (isCtrl) {
            // Duplicate
            if (selectedAnnotation) {
              duplicateAnnotation(selectedAnnotation);
            }
          } else {
            // Draw mode
            setMode(mode === "draw" ? "none" : "draw");
          }
          break;
        case "t":
          if (!isCtrl) {
            e.preventDefault();
            setMode("text");
            addText();
          }
          break;

        // Selection and editing
        case "a":
          if (isCtrl) {
            e.preventDefault();
            selectAllVisibleAnnotations();
          }
          break;
        case "c":
          if (isCtrl) {
            e.preventDefault();
            copySelectedAnnotations();
          }
          break;
        case "v":
          if (isCtrl) {
            e.preventDefault();
            pasteAnnotations();
          }
          break;
        case "x":
          if (isCtrl) {
            e.preventDefault();
            cutSelectedAnnotations();
          }
          break;
        case "delete":
        case "backspace":
          e.preventDefault();
          if (isCtrl && isShift) {
            deleteAllAnnotations();
          } else {
            deleteSelectedAnnotations();
          }
          break;

        // Undo/Redo
        case "z":
          if (isCtrl && !isShift) {
            e.preventDefault();
            undo();
          } else if (isCtrl && isShift) {
            e.preventDefault();
            redo();
          }
          break;
        case "y":
          if (isCtrl) {
            e.preventDefault();
            redo();
          }
          break;

        // Deselect
        case "escape":
          e.preventDefault();
          setSelectedAnnotation(null);
          setSelectedAnnotations([]);
          setMode("none");
          break;
      }
    };

    v.addEventListener("timeupdate", handleTimeUpdate);
    v.addEventListener("loadedmetadata", handleLoadedMetadata);
    v.addEventListener("play", handlePlay);
    v.addEventListener("pause", handlePause);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("loadedmetadata", handleLoadedMetadata);
      v.removeEventListener("play", handlePlay);
      v.removeEventListener("pause", handlePause);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [volume, muted, mode, selectedAnnotation, annotations]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.volume = volume;
      v.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    render();
  }, [
    annotations,
    currentTime,
    currentStroke,
    selectedAnnotation,
    selectedAnnotations,
  ]);

  // Undo
  const undo = () => {
    if (undoHistory.length === 0) return;
    const previousState = undoHistory[undoHistory.length - 1];
    setRedoHistory((prev) => [annotations, ...prev]);
    setUndoHistory((prev) => prev.slice(0, -1));
    setAnnotations(previousState);
    setSelectedAnnotation(null);
    setSelectedAnnotations([]);
  };

  // Redo
  const redo = () => {
    if (redoHistory.length === 0) return;
    const nextState = redoHistory[0];
    setUndoHistory((prev) => [...prev, annotations]);
    setRedoHistory((prev) => prev.slice(1));
    setAnnotations(nextState);
    setSelectedAnnotation(null);
    setSelectedAnnotations([]);
  };

  // Select all
  const selectAllVisibleAnnotations = () => {
    const t = videoRef.current!.currentTime;
    const visibleIds = annotations
      .filter((a) => t >= a.timestamp && t <= a.timestamp + a.duration)
      .map((a) => a.id);
    setSelectedAnnotations(visibleIds);
    setSelectedAnnotation(visibleIds.length === 1 ? visibleIds[0] : null);
  };

  // Copy
  const copySelectedAnnotations = () => {
    const targetIds =
      selectedAnnotations.length > 0
        ? selectedAnnotations
        : selectedAnnotation
          ? [selectedAnnotation]
          : [];
    const annotationsToCopy = annotations.filter((a) =>
      targetIds.includes(a.id),
    );
    setCopiedAnnotations(annotationsToCopy);
  };

  // Cut
  const cutSelectedAnnotations = () => {
    copySelectedAnnotations();
    deleteSelectedAnnotations();
  };

  // Paste
  const pasteAnnotations = () => {
    if (copiedAnnotations.length === 0) return;

    saveState();
    const currentTimestamp = videoRef.current!.currentTime;
    const newAnnotations = copiedAnnotations.map((a) => ({
      ...a,
      id: uid(a.type.charAt(0)),
      timestamp: currentTimestamp,
    }));

    setAnnotations((prev) => [...prev, ...newAnnotations]);

    const newIds = newAnnotations.map((a) => a.id);
    setSelectedAnnotations(newIds);
    setSelectedAnnotation(newIds.length === 1 ? newIds[0] : null);
  };

  // Delete
  const deleteSelectedAnnotations = () => {
    const targetIds =
      selectedAnnotations.length > 0
        ? selectedAnnotations
        : selectedAnnotation
          ? [selectedAnnotation]
          : [];
    if (targetIds.length === 0) return;

    saveState();
    setAnnotations((prev) => prev.filter((a) => !targetIds.includes(a.id)));
    setSelectedAnnotation(null);
    setSelectedAnnotations([]);
  };

  // Delete all
  const deleteAllAnnotations = () => {
    if (annotations.length === 0) return;
    const confirmed = confirm(
      `Delete all ${annotations.length} annotations? This cannot be undone.`,
    );
    if (!confirmed) return;

    saveState();
    setAnnotations([]);
    setSelectedAnnotation(null);
    setSelectedAnnotations([]);
  };

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

      const isSelected =
        selectedAnnotation === a.id || selectedAnnotations.includes(a.id);

      if (a.type === "stroke") {
        ctx.beginPath();
        ctx.lineWidth = a.width + (isSelected ? 2 : 0);
        ctx.strokeStyle = isSelected ? "#ff6b6b" : a.color;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        const pts = a.points;
        ctx.moveTo(pts[0].x * c.width, pts[0].y * c.height);
        pts.slice(1).forEach((p) => ctx.lineTo(p.x * c.width, p.y * c.height));
        ctx.stroke();
      } else {
        const textAnnotation = a as TextNote;
        ctx.fillStyle = isSelected ? "#ff6b6b" : a.color;
        ctx.font = `${textAnnotation.fontSize || fontSize}px sans-serif`;
        ctx.fillText(textAnnotation.text, a.x * c.width, a.y * c.height);

        if (isSelected) {
          const metrics = ctx.measureText(textAnnotation.text);
          const textHeight = textAnnotation.fontSize || fontSize;
          ctx.strokeStyle = "#ff6b6b";
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(
            a.x * c.width - 2,
            a.y * c.height - textHeight,
            metrics.width + 4,
            textHeight + 4,
          );
          ctx.setLineDash([]);
        }
      }
    });

    if (currentStroke) {
      ctx.beginPath();
      ctx.lineWidth = currentStroke.width;
      ctx.strokeStyle = currentStroke.color;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      const pts = currentStroke.points;
      ctx.moveTo(pts[0].x * c.width, pts[0].y * c.height);
      pts.slice(1).forEach((p) => ctx.lineTo(p.x * c.width, p.y * c.height));
      ctx.stroke();
    }
  }

  function togglePlayPause() {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    videoRef.current!.src = url;
    setAnnotations([]);
    setSelectedAnnotation(null);
    setSelectedAnnotations([]);
    setUndoHistory([]);
    setRedoHistory([]);
  }

  function norm(e: React.PointerEvent | React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left) / rect.width),
      y: clamp((e.clientY - rect.top) / rect.height),
    };
  }

  function findAnnotationAt(point: { x: number; y: number }) {
    const t = videoRef.current!.currentTime;
    const c = canvasRef.current!;

    for (const a of annotations.slice().reverse()) {
      if (t < a.timestamp || t > a.timestamp + a.duration) continue;
      if (a.type === "text") {
        const textAnnotation = a as TextNote;
        const ctx = c.getContext("2d")!;
        ctx.font = `${textAnnotation.fontSize || fontSize}px sans-serif`;
        const metrics = ctx.measureText(textAnnotation.text);
        const textHeight = textAnnotation.fontSize || fontSize;

        const left = a.x - 0.01;
        const right = a.x + metrics.width / c.width + 0.01;
        const top = a.y - textHeight / c.height;
        const bottom = a.y + 0.02;

        if (
          point.x >= left &&
          point.x <= right &&
          point.y >= top &&
          point.y <= bottom
        ) {
          return a.id;
        }
      }
    }

    return null;
  }

  function down(e: React.PointerEvent) {
    const p = norm(e);

    const hitAnnotation = findAnnotationAt(p);
    if (hitAnnotation && mode === "none") {
      setSelectedAnnotation(hitAnnotation);
      setSelectedAnnotations([hitAnnotation]);
      const annotation = annotations.find((a) => a.id === hitAnnotation);
      if (annotation && annotation.type === "text") {
        setDragOffset({ x: p.x - annotation.x, y: p.y - annotation.y });
      }
      return;
    }

    if (mode === "draw") {
      saveState();
      const s: Stroke = {
        id: uid("s"),
        type: "stroke",
        timestamp: videoRef.current!.currentTime,
        duration: Math.max(0.1, Number(strokeDuration)),
        points: [p],
        color,
        width,
      };
      setCurrentStroke(s);
    }

    setSelectedAnnotation(null);
    setSelectedAnnotations([]);
  }

  function move(e: React.PointerEvent) {
    const p = norm(e);

    if (selectedAnnotation && dragOffset && mode === "none") {
      setAnnotations((anns) =>
        anns.map((a) =>
          a.id === selectedAnnotation && a.type === "text"
            ? { ...a, x: p.x - dragOffset.x, y: p.y - dragOffset.y }
            : a,
        ),
      );
      return;
    }

    if (currentStroke) {
      setCurrentStroke((s) => (s ? { ...s, points: [...s.points, p] } : s));
    }
  }

  function up() {
    if (currentStroke) {
      const simp = simplify(currentStroke.points, 0.003);
      setAnnotations((a) => [...a, { ...currentStroke, points: simp }]);
      setCurrentStroke(null);
    }
    setDragOffset(null);
  }

  function addText() {
    const txt = prompt("Enter text");
    if (!txt) return;
    saveState();
    const note: TextNote = {
      id: uid("t"),
      type: "text",
      timestamp: videoRef.current!.currentTime,
      duration: 2,
      x: 0.5,
      y: 0.2,
      text: txt,
      color,
      fontSize,
    };
    setAnnotations((a) => [...a, note]);
    setSelectedAnnotation(note.id);
    setSelectedAnnotations([note.id]);
  }

  function updateSelectedTextSize(newSize: number) {
    if (!selectedAnnotation) return;
    setAnnotations((anns) =>
      anns.map((a) =>
        a.id === selectedAnnotation && a.type === "text"
          ? { ...a, fontSize: newSize }
          : a,
      ),
    );
  }

  function updateSelectedText() {
    if (!selectedAnnotation) return;
    const annotation = annotations.find((a) => a.id === selectedAnnotation);
    if (!annotation || annotation.type !== "text") return;

    const newText = prompt("Edit text", (annotation as TextNote).text);
    if (newText === null) return;

    saveState();
    setAnnotations((anns) =>
      anns.map((a) =>
        a.id === selectedAnnotation ? { ...a, text: newText } : a,
      ),
    );
  }

  function duplicateAnnotation(id: string) {
    const annotation = annotations.find((a) => a.id === id);
    if (!annotation) return;

    saveState();
    const duplicate = {
      ...annotation,
      id: uid(annotation.type.charAt(0)),
      timestamp: videoRef.current!.currentTime,
    };

    setAnnotations((a) => [...a, duplicate]);
    setSelectedAnnotation(duplicate.id);
    setSelectedAnnotations([duplicate.id]);
  }

  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then((txt) => {
      saveState();
      const data: ExportPayload = JSON.parse(txt);
      setAnnotations(data.annotations);
      setSelectedAnnotation(null);
      setSelectedAnnotations([]);
    });
  }

  const selectedAnnotationData = selectedAnnotation
    ? annotations.find((a) => a.id === selectedAnnotation)
    : null;

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ flex: 1 }}>
        {/* Main Controls */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button onClick={() => fileInputRef.current?.click()}>
            Load Video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button onClick={togglePlayPause} style={{ minWidth: "80px" }}>
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <span style={{ fontSize: "12px", color: "#aaa" }}>
              {Math.floor(currentTime / 60)}:
              {(currentTime % 60).toFixed(1).padStart(4, "0")} /{" "}
              {Math.floor(duration / 60)}:
              {(duration % 60).toFixed(0).padStart(2, "0")}
            </span>
          </div>

          <button
            onClick={() => setMode(mode === "draw" ? "none" : "draw")}
            style={{ background: mode === "draw" ? "var(--accent)" : "" }}
          >
            ✏️ Draw
          </button>

          {/* Stroke duration selector */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderRadius: 8,
              background: "rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 1px 1px rgba(0,0,0,0.02)",
            }}
          >
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={strokeDuration}
              onChange={(e) => {
                setStrokeDuration(e.target.value);
              }}
              onBlur={() => {
                const v = parseFloat(strokeDuration as string);
                if (isNaN(v)) {
                  setStrokeDuration(0.1);
                } else {
                  setStrokeDuration(Math.max(0.1, v));
                }
              }}
              style={{
                width: 36,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid rgba(0,0,0,0.12)",
                fontSize: 13,
                background: "#fff",
                color: "#111",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
              }}
            />
            <span style={{ fontSize: 12, marginLeft: 5, color: "#666" }}>
              s
            </span>
          </div>

          <button onClick={addText}>💬 Add Text</button>

          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <label style={{ fontSize: "12px" }}>Brush:</label>
            <input
              type="range"
              min={1}
              max={10}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              style={{ width: "60px" }}
            />
            <span style={{ fontSize: "12px" }}>{width}px</span>
          </div>

          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <label style={{ fontSize: "12px" }}>Font:</label>
            <input
              type="range"
              min={12}
              max={48}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ width: "60px" }}
            />
            <span style={{ fontSize: "12px" }}>{fontSize}px</span>
          </div>

          {/* Undo/Redo buttons */}
          <button
            onClick={undo}
            disabled={undoHistory.length === 0}
            style={{ opacity: undoHistory.length === 0 ? 0.5 : 1 }}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            onClick={redo}
            disabled={redoHistory.length === 0}
            style={{ opacity: redoHistory.length === 0 ? 0.5 : 1 }}
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>

          <button onClick={() => setShowExportPopup(true)}>💾 Export</button>
          <button onClick={() => importInputRef.current?.click()}>
            📂 Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={importJSON}
          />

          <SettingsMenu
            volume={volume}
            onVolumeChange={setVolume}
            muted={muted}
            onMuteToggle={() => setMuted((prev) => !prev)}
          />
        </div>

        {/* Selected Annotation Controls */}
        {selectedAnnotationData && (
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--accent)",
              borderRadius: "6px",
              padding: "8px",
              marginBottom: "8px",
              display: "flex",
              gap: "8px",
              alignItems: "center",
              fontSize: "14px",
            }}
          >
            <span>Selected: {selectedAnnotationData.type}</span>
            {selectedAnnotationData.type === "text" && (
              <>
                <button
                  onClick={updateSelectedText}
                  style={{ padding: "2px 6px", fontSize: "12px" }}
                >
                  ✏️ Edit Text
                </button>
                <label style={{ fontSize: "12px" }}>Size:</label>
                <input
                  type="range"
                  min={12}
                  max={48}
                  value={
                    (selectedAnnotationData as TextNote).fontSize || fontSize
                  }
                  onChange={(e) =>
                    updateSelectedTextSize(Number(e.target.value))
                  }
                  style={{ width: "60px" }}
                />
                <span style={{ fontSize: "12px" }}>
                  {(selectedAnnotationData as TextNote).fontSize || fontSize}px
                </span>
              </>
            )}
            <button
              onClick={() => duplicateAnnotation(selectedAnnotation!)}
              style={{ padding: "2px 6px", fontSize: "12px" }}
              title="Duplicate (Ctrl+D)"
            >
              📋 Duplicate
            </button>
            <button
              onClick={() => {
                setSelectedAnnotation(null);
                setSelectedAnnotations([]);
              }}
              style={{ padding: "2px 6px", fontSize: "12px" }}
              title="Deselect (Esc)"
            >
              ✕
            </button>
          </div>
        )}

        {/* Video Container */}
        <div
          style={{
            position: "relative",
            background: "#000",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <video
            ref={videoRef}
            style={{ width: "100%", display: "block" }}
            onContextMenu={(e) => e.preventDefault()}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              cursor:
                mode === "draw"
                  ? "crosshair"
                  : mode === "text"
                    ? "text"
                    : "default",
            }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
          />
        </div>

        {/* Enhanced Timeline */}
        <div style={{ marginTop: 12 }}>
          <Timeline
            duration={duration}
            current={currentTime}
            annotations={annotations}
            onSeek={(t) => (videoRef.current!.currentTime = t)}
          />
        </div>
      </div>

      {/* Annotation Sidebar */}
      <div className="annotation-list">
        <div style={{ marginBottom: 8, fontSize: "14px", fontWeight: "bold" }}>
          Annotations ({annotations.length})
        </div>
        {annotations.map((a) => (
          <div
            key={a.id}
            style={{
              marginBottom: 6,
              padding: 4,
              background: selectedAnnotations.includes(a.id)
                ? "var(--accent)"
                : "transparent",
              borderRadius: 4,
              cursor: "pointer",
            }}
            onClick={() => {
              const isCurrentlySelected = selectedAnnotations.includes(a.id);
              if (isCurrentlySelected) {
                setSelectedAnnotations([]);
                setSelectedAnnotation(null);
              } else {
                setSelectedAnnotations([a.id]);
                setSelectedAnnotation(a.id);
              }
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                {a.type} @ {a.timestamp.toFixed(1)}s
              </span>
              <div style={{ display: "flex", gap: 2 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    videoRef.current!.currentTime = a.timestamp;
                  }}
                  style={{ padding: "2px 4px", fontSize: "10px" }}
                  title="Go to timestamp"
                >
                  ⏯
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveState();
                    setAnnotations((anns) => anns.filter((x) => x.id !== a.id));
                    if (selectedAnnotation === a.id) {
                      setSelectedAnnotation(null);
                      setSelectedAnnotations([]);
                    }
                  }}
                  style={{ padding: "2px 4px", fontSize: "10px" }}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>
            {a.type === "text" && (
              <div style={{ fontSize: "12px", color: "#ccc", marginTop: 2 }}>
                "{(a as TextNote).text}"
              </div>
            )}
            <div style={{ fontSize: "11px", color: "#999", marginTop: 2 }}>
              Duration: {a.duration}s
            </div>
          </div>
        ))}
      </div>

      {/* Export Popup */}
      <ExportPopup
        isOpen={showExportPopup}
        onClose={() => setShowExportPopup(false)}
        annotations={annotations}
        videoRef={videoRef}
        fontSize={fontSize}
      />
    </div>
  );
}
