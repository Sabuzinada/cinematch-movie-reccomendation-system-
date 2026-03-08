import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
  showLabel?: boolean;
};

const sizeMap = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function StarRating({
  value,
  onChange,
  size = "md",
  readonly = false,
  showLabel = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = hoverValue || value;

  return (
    <div className="flex items-center gap-1">
      <div
        className={cn("star-rating flex items-center gap-0.5", {
          "pointer-events-none": readonly,
        })}
        onMouseLeave={() => !readonly && setHoverValue(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={cn(
              "star p-0.5 transition-colors focus:outline-none",
              displayValue >= star
                ? "text-gold"
                : "text-muted-foreground/30"
            )}
            style={
              displayValue >= star
                ? { color: "oklch(0.82 0.12 85)" }
                : undefined
            }
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHoverValue(star)}
            disabled={readonly}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            <Star
              className={cn(sizeMap[size])}
              fill={displayValue >= star ? "currentColor" : "none"}
              strokeWidth={displayValue >= star ? 0 : 1.5}
            />
          </button>
        ))}
      </div>
      {showLabel && displayValue > 0 && (
        <span className="text-sm text-muted-foreground ml-1.5">
          {labels[displayValue]}
        </span>
      )}
    </div>
  );
}
