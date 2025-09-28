import React, { useState, useRef } from "react";
import { Annotation, TextNote, ExportPayload } from "../types";

interface ExportPopupProps {
  isOpen: boolean;
  onClose: () => void;
  annotations: Annotation[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  fontSize: number;
}

export default function ExportPopup({
  isOpen,
  onClose,
  annotations,
  videoRef,
  fontSize,
}: ExportPopupProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportType, setExportType] = useState<"json" | "video">("json");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!isOpen) return null;

  const exportJSON = () => {
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
    URL.revokeObjectURL(url);
    onClose();
  };

  const renderAnnotationsOnCanvas = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    currentTime: number,
  ) => {
    annotations.forEach((a) => {
      if (currentTime < a.timestamp || currentTime > a.timestamp + a.duration)
        return;

      if (a.type === "stroke") {
        ctx.beginPath();
        ctx.lineWidth = a.width;
        ctx.strokeStyle = a.color;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        const pts = a.points;
        if (pts.length > 0) {
          ctx.moveTo(pts[0].x * canvas.width, pts[0].y * canvas.height);
          pts
            .slice(1)
            .forEach((p) =>
              ctx.lineTo(p.x * canvas.width, p.y * canvas.height),
            );
          ctx.stroke();
        }
      } else if (a.type === "text") {
        const textAnnotation = a as TextNote;
        ctx.fillStyle = a.color;
        ctx.font = `${textAnnotation.fontSize || fontSize}px sans-serif`;
        ctx.fillText(
          textAnnotation.text,
          a.x * canvas.width,
          a.y * canvas.height,
        );
      }
    });
  };

  const exportVideoWithAnnotations = async () => {
    const video = videoRef.current;
    if (!video || !video.src) {
      alert("No video loaded");
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Create MediaRecorder stream
      const stream = canvas.captureStream(30); // 30 fps

      // Get audio track from video
      let audioStream: MediaStream | null = null;
      try {
        // Create audio context to capture audio
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioContext.destination);
        audioStream = destination.stream;

        // Add audio track to stream
        if (audioStream.getAudioTracks().length > 0) {
          audioStream.getAudioTracks().forEach((track) => {
            stream.addTrack(track);
          });
        }
      } catch (audioError) {
        console.warn("Could not capture audio:", audioError);
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "annotated-video.webm";
        a.click();
        URL.revokeObjectURL(url);
        setIsExporting(false);
        onClose();
      };

      // Start recording
      mediaRecorder.start();

      // Reset video to beginning
      video.currentTime = 0;
      const originalPlaybackRate = video.playbackRate;
      video.playbackRate = 1; // Ensure normal playback speed

      // Function to render frame
      const renderFrame = () => {
        if (!video.paused && !video.ended) {
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw video frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Draw annotations
          renderAnnotationsOnCanvas(ctx, canvas, video.currentTime);

          // Update progress
          setExportProgress((video.currentTime / video.duration) * 100);

          requestAnimationFrame(renderFrame);
        } else if (video.ended) {
          // Stop recording when video ends
          mediaRecorder.stop();
          video.playbackRate = originalPlaybackRate;
          if (audioStream) {
            audioStream.getTracks().forEach((track) => track.stop());
          }
        }
      };

      // Start playback and rendering
      video.play();
      renderFrame();
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
      setIsExporting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "black",
        }}
        onClick={onClose}
      >
        {/* Modal */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "24px",
            minWidth: "400px",
            maxWidth: "500px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            Export Options
          </h2>

          {!isExporting ? (
            <>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "500",
                  }}
                >
                  Export Type:
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      value="json"
                      checked={exportType === "json"}
                      onChange={(e) => setExportType(e.target.value as "json")}
                    />
                    <span>JSON Annotations</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      value="video"
                      checked={exportType === "video"}
                      onChange={(e) => setExportType(e.target.value as "video")}
                    />
                    <span>Video with Annotations</span>
                  </label>
                </div>
              </div>

              <div
                style={{
                  marginBottom: "20px",
                  padding: "12px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "6px",
                }}
              >
                {exportType === "json" ? (
                  <div>
                    <strong>JSON Export:</strong>
                    <p
                      style={{
                        margin: "4px 0",
                        fontSize: "14px",
                        color: "#666",
                      }}
                    >
                      Exports all annotations as a JSON file that can be
                      imported later. Includes timestamps, positions, colors,
                      and text content.
                    </p>
                  </div>
                ) : (
                  <div>
                    <strong>Video Export:</strong>
                    <p
                      style={{
                        margin: "4px 0",
                        fontSize: "14px",
                        color: "#666",
                      }}
                    >
                      Creates a new video file with annotations permanently
                      drawn on it. Preserves original quality and audio. Export
                      time depends on video length.
                    </p>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={onClose}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    backgroundColor: "white",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={
                    exportType === "json"
                      ? exportJSON
                      : exportVideoWithAnnotations
                  }
                  style={{
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    backgroundColor: "#007bff",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                  disabled={exportType === "video" && !videoRef.current?.src}
                >
                  {exportType === "json" ? "Export JSON" : "Export Video"}
                </button>
              </div>
            </>
          ) : (
            <div>
              <h3 style={{ margin: "0 0 16px 0" }}>Exporting Video...</h3>
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  backgroundColor: "#e0e0e0",
                  borderRadius: "4px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    width: `${exportProgress}%`,
                    height: "100%",
                    backgroundColor: "#007bff",
                    borderRadius: "4px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#666",
                  textAlign: "center",
                }}
              >
                {exportProgress.toFixed(1)}% complete
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for video rendering */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </>
  );
}
