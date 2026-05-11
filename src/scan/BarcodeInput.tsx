import { ScanBarcode, Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CameraScanner from "./CameraScanner";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Suppress the on-screen soft keyboard (recommended for handheld scanners like Urovo DT50S). */
  suppressKeyboard?: boolean;
}

export default function BarcodeInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus = true,
  suppressKeyboard = true,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Persistent autofocus — hardware scanners send keystrokes to the focused field.
  // Re-focus on tab visibility change and on window focus, so scans never get lost.
  useEffect(() => {
    if (!autoFocus) return;
    const focus = () => ref.current?.focus();
    focus();
    const onVis = () => { if (document.visibilityState === "visible") focus(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [autoFocus]);

  return (
    <>
      <div className="relative">
        <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary pointer-events-none" />
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
          // Re-focus immediately if the user (or system) moves focus elsewhere.
          onBlur={() => {
            if (autoFocus) setTimeout(() => ref.current?.focus(), 50);
          }}
          placeholder={placeholder || "סרוק ברקוד..."}
          className="w-full h-14 bg-background border-2 border-primary/40 rounded-xl pr-11 pl-14 text-base font-mono tracking-wider text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition"
          // readOnly suppresses the Android soft keyboard while still receiving keystrokes
          // from the hardware scanner (which uses HID/keyboard wedge).
          readOnly={suppressKeyboard}
          onFocus={(e) => {
            // Allow the cursor to be at end so additional manual typing works after toggling.
            const v = e.target.value;
            e.target.setSelectionRange(v.length, v.length);
          }}
          inputMode={suppressKeyboard ? "none" : "text"}
          autoComplete="off"
          spellCheck={false}
          aria-label="שדה ברקוד"
        />
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-lg bg-primary/15 text-primary hover:bg-primary/25 active:scale-95 transition"
          aria-label="סרוק במצלמה"
          title="סרוק במצלמה"
        >
          <Camera className="w-5 h-5" />
        </button>
      </div>

      {cameraOpen && (
        <CameraScanner
          onClose={() => {
            setCameraOpen(false);
            setTimeout(() => ref.current?.focus(), 50);
          }}
          onDetected={(code) => {
            setCameraOpen(false);
            onChange(code);
            // submit on next tick so onChange propagates
            setTimeout(() => {
              onSubmit();
              ref.current?.focus();
            }, 30);
          }}
        />
      )}
    </>
  );
}
