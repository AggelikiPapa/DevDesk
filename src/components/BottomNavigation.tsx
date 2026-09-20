import { PreviewButton } from "./PreviewButton";

export function BottomNavigation() {
  return (
    <footer className="app-footer">
      <nav aria-label="Secondary">
        <PreviewButton>Today</PreviewButton>
        <PreviewButton>Settings</PreviewButton>
      </nav>
    </footer>
  );
}
