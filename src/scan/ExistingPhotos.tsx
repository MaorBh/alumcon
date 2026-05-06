import { useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { SCAN_LOG, getStationName } from "./scanData";

const actionLabels: Record<string, string> = {
  station_pass: "אישור תחנה",
  station_reject: "פסילת תחנה",
  qc_pass: "אישור בקר",
  qc_reject: "פסילת בקר",
  qc_final: "אישור סופי",
};

export default function ExistingPhotos({ itemId }: { itemId: string }) {
  const [preview, setPreview] = useState<string | null>(null);

  const records = SCAN_LOG.filter((r) => r.itemId === itemId && r.photos.length > 0);
  if (records.length === 0) return null;

  const total = records.reduce((s, r) => s + r.photos.length, 0);

  return (
    <div className="surface-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ImageIcon className="w-4 h-4 text-primary" />
        תמונות קיימות
        <span className="text-xs text-muted-foreground font-normal">({total})</span>
      </div>

      <div className="space-y-3">
        {records.map((r) => (
          <div key={r.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">
                {actionLabels[r.action] || r.action}
                {r.stationId && ` · ${getStationName(r.stationId)}`}
              </span>
              <span className="shrink-0">
                {new Date(r.timestamp).toLocaleString("he-IL", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {r.photos.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPreview(p)}
                  className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:border-primary transition"
                >
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            {r.notes && (
              <div className="text-[11px] text-muted-foreground italic truncate">
                "{r.notes}"
              </div>
            )}
          </div>
        ))}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-background/20 backdrop-blur flex items-center justify-center text-white"
            onClick={() => setPreview(null)}
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
          <img src={preview} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}
