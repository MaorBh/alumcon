import { Camera, X } from "lucide-react";
import { useRef } from "react";

interface Props {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  required?: boolean;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PhotoCapture({ photos, onChange, max = 3, required }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    onChange([...photos, url].slice(0, max));
    e.target.value = "";
  };

  const removeAt = (idx: number) => onChange(photos.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold">
          תמונות {required && <span className="text-status-rejected">*</span>}
          <span className="text-xs text-muted-foreground font-normal mr-2">
            ({photos.length}/{max})
          </span>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted"
          >
            <img src={p} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-1 left-1 w-6 h-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground hover:bg-status-rejected hover:text-white transition"
              aria-label="הסר"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary hover:border-primary transition"
          >
            <Camera className="w-7 h-7" />
            <span className="text-[11px]">צלם</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
