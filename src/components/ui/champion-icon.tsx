"use client";

import { getChampionIconUrl } from "@/lib/champions";
import { cn } from "@/lib/cn";

interface ChampionIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function ChampionIcon({ name, size = 28, className }: ChampionIconProps) {
  const url = getChampionIconUrl(name);

  if (!url) {
    return (
      <div
        className={cn(
          "rounded bg-surface-2 flex items-center justify-center text-xs font-semibold text-ink-subtle shrink-0",
          className
        )}
        style={{ width: size, height: size }}
      >
        {name.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      className={cn("rounded shrink-0 object-cover", className)}
      onError={(e) => {
        // Fallback to initial
        const el = e.currentTarget;
        el.style.display = "none";
        const fallback = document.createElement("div");
        fallback.className = `rounded bg-surface-2 flex items-center justify-center text-xs font-semibold text-ink-subtle`;
        fallback.style.width = `${size}px`;
        fallback.style.height = `${size}px`;
        fallback.textContent = name.charAt(0);
        el.parentElement?.appendChild(fallback);
      }}
    />
  );
}
