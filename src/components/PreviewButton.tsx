import type { ReactNode } from "react";

export function PreviewButton({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  return (
    <button type="button" className={primary ? "preview-button primary" : "preview-button"}
      aria-disabled="true" title="Unavailable in this visual preview">
      {children}
    </button>
  );
}
