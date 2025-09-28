import { useState, useRef, useEffect } from "react";

type SettingsMenuProps = {
  volume: number;
  onVolumeChange: (volume: number) => void;
  muted: boolean;
  onMuteToggle: () => void;
};

export default function SettingsMenu({
  volume,
  onVolumeChange,
  muted,
  onMuteToggle,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const volumeIcon = muted
    ? "🔇"
    : volume === 0
      ? "🔈"
      : volume < 0.5
        ? "🔉"
        : "🔊";

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: isOpen ? "var(--accent)" : "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "6px 10px",
          cursor: "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          color: "var(--fg)",
        }}
        title="Settings"
      >
        ⚙️ Settings
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            top: "100%",
            right: "0",
            marginTop: "4px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "12px",
            minWidth: "220px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
            zIndex: 1000,
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Settings Header */}
          <div
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              marginBottom: "12px",
              paddingBottom: "8px",
              borderBottom: "1px solid var(--border)",
              color: "var(--fg)",
            }}
          >
            Audio Settings
          </div>

          {/* Volume Section */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <label style={{ fontSize: "13px", color: "var(--fg)" }}>
                Volume
              </label>
              <span style={{ fontSize: "12px", color: "#aaa" }}>
                {Math.round(volume * 100)}%
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <button
                onClick={onMuteToggle}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "4px 6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  minWidth: "32px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--fg)",
                }}
                title={muted ? "Unmute" : "Mute"}
              >
                {volumeIcon}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const newVolume = parseFloat(e.target.value);
                  onVolumeChange(newVolume);
                  if (newVolume > 0 && muted) {
                    onMuteToggle();
                  }
                }}
                style={{
                  flex: 1,
                  accentColor: "var(--accent)",
                  height: "4px",
                  background: "#444",
                  borderRadius: "2px",
                  outline: "none",
                  cursor: "pointer",
                }}
              />
            </div>
          </div>

          {/* Quick Volume Presets */}
          <div>
            <div
              style={{
                fontSize: "13px",
                color: "var(--fg)",
                marginBottom: "8px",
              }}
            >
              Quick Sets
            </div>
            <div
              style={{
                display: "flex",
                gap: "4px",
              }}
            >
              {[0.25, 0.5, 0.75, 1.0].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    onVolumeChange(preset);
                    if (muted && preset > 0) {
                      onMuteToggle();
                    }
                  }}
                  style={{
                    background:
                      Math.abs(volume - preset) < 0.01 && !muted
                        ? "var(--accent)"
                        : "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    padding: "2px 6px",
                    cursor: "pointer",
                    fontSize: "11px",
                    color: "var(--fg)",
                    flex: 1,
                    textAlign: "center",
                  }}
                >
                  {Math.round(preset * 100)}%
                </button>
              ))}
            </div>
          </div>

          {/* Keyboard Shortcuts Info */}
          <div
            style={{
              marginTop: "12px",
              paddingTop: "8px",
              borderTop: "1px solid var(--border)",
              fontSize: "11px",
              color: "#888",
            }}
          >
            {/* Keyboard Shortcuts Help */}
            <details
              style={{ marginBottom: 8, fontSize: "12px", color: "#888" }}
            >
              <summary style={{ cursor: "pointer" }}>
                Keyboard Shortcuts
              </summary>
              <div style={{ marginTop: 4, lineHeight: 1.4 }}>
                <strong>Playback:</strong> Space/K (play/pause), ←→ (seek 5s),
                Shift+←→ (seek 10s), Ctrl+←→ (seek 1s)
                <br />
                <strong>Volume:</strong> ↑↓ (volume), M (mute)
                <br />
                <strong>Tools:</strong> D (draw mode), T (add text), Esc
                (deselect)
                <br />
                <strong>Edit:</strong> Ctrl+A (select all), Ctrl+C (copy),
                Ctrl+V (paste), Ctrl+X (cut), Ctrl+D (duplicate)
                <br />
                <strong>Delete:</strong> Del (selected), Ctrl+Shift+Del (all)
                <br />
                <strong>Undo:</strong> Ctrl+Z (undo), Ctrl+Y/Ctrl+Shift+Z (redo)
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
