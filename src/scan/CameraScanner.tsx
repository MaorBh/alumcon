import { useEffect, useRef, useState } from "react";
import { X, Camera as CameraIcon, AlertTriangle } from "lucide-react";

// Native BarcodeDetector — supported on Chrome / Android WebView (incl. Urovo DT50S, Android 11+).
// We feature-detect and fail gracefully.
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

const FORMATS = [
  "code_128",
  "code_39",
  "code_93",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "qr_code",
  "data_matrix",
  "pdf417",
];

export default function CameraScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const supportsDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
    setSupported(supportsDetector);
    if (!supportsDetector) {
      setError("הדפדפן לא תומך בסריקת מצלמה. השתמש בסורק החומרה של המסופון או בדפדפן Chrome מעודכן.");
      return;
    }

    let detector: any;
    try {
      detector = new window.BarcodeDetector({ formats: FORMATS });
    } catch {
      detector = new window.BarcodeDetector();
    }

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        loop(detector);
      } catch (e: any) {
        setError(e?.message || "לא ניתן לגשת למצלמה. אשר הרשאת מצלמה בדפדפן.");
      }
    };

    const loop = async (det: any) => {
      if (stoppedRef.current || !videoRef.current) return;
      try {
        const codes = await det.detect(videoRef.current);
        if (codes && codes.length > 0 && codes[0].rawValue) {
          stop();
          onDetected(String(codes[0].rawValue));
          return;
        }
      } catch {
        // ignore frame errors
      }
      rafRef.current = requestAnimationFrame(() => loop(det));
    };

    const stop = () => {
      stoppedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" dir="rtl">
      <div className="h-12 flex items-center justify-between px-3 bg-black/70 text-white">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CameraIcon className="w-4 h-4" />
          סריקה במצלמה
        </div>
        <button
          onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
          aria-label="סגור"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="m-4 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-100 max-w-sm text-center space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-red-400" />
            <div className="text-sm">{error}</div>
            <button
              onClick={onClose}
              className="mt-2 h-10 px-4 rounded-lg bg-white text-black text-sm font-semibold"
            >
              סגור
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {/* viewfinder */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-72 h-40 border-2 border-primary rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-white text-xs bg-black/60 px-3 py-1 rounded-full whitespace-nowrap">
                  כוון את המצלמה אל הברקוד
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {supported === false ? null : (
        <div className="px-4 py-3 bg-black/70 text-white/80 text-[11px] text-center">
          טיפ: לסריקה מהירה יותר השתמש בכפתור הסריקה הפיזי של המסופון
        </div>
      )}
    </div>
  );
}
