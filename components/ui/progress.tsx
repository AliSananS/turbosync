import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current progress value */
  value: number;
  /** Total value (for percentage calculation) */
  total?: number;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Size of the progress bar */
  size?: "sm" | "md" | "lg";
  /** Whether the progress is indeterminate */
  indeterminate?: boolean;
  /** Color variant */
  variant?: "default" | "destructive";
}

export function Progress({
  className,
  value,
  total = 100,
  showPercentage = true,
  size = "md",
  indeterminate = false,
  variant = "default",
  ...props
}: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / total) * 100));

  return (
    <div
      className={cn(
        "w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden",
        size === "sm" && "h-1.5",
        size === "lg" && "h-3",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full transition-width duration-300 ease-in-out",
          variant === "destructive" && "bg-red-500",
          variant === "default" && "bg-blue-500",
          indeterminate && "animate-pulse bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600"
        )}
        style={{ width: indeterminate ? "100%" : `${percent}%` }}
      />
    </div>
  );
}

Progress.displayName = "Progress";