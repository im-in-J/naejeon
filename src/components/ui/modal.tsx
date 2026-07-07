"use client";

import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={cn(
        "relative w-full max-w-lg rounded-xl bg-surface-1 border border-hairline flex flex-col max-h-[calc(100vh-2rem)]",
        className
      )}>
        {title && (
          <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-4 shrink-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-ink-tertiary hover:text-ink hover:bg-surface-2 transition-fast cursor-pointer shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className={cn("overflow-y-auto px-5 pb-5", title ? "pt-0" : "pt-5")}>
          {children}
        </div>
      </div>
    </div>
  );
}
