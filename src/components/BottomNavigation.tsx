interface BottomNavigationProps {
  view: "tasks" | "today";
  onView: (view: "tasks" | "today") => void;
}

export function BottomNavigation({ view, onView }: BottomNavigationProps) {
  return (
    <footer className="app-footer">
      <nav aria-label="Views">
        <button type="button" aria-current={view === "tasks" ? "page" : undefined}
          onClick={() => onView("tasks")}>Tasks</button>
        <button type="button" aria-current={view === "today" ? "page" : undefined}
          onClick={() => onView("today")}>Today</button>
        <button type="button" aria-disabled="true" title="Not available yet">Settings</button>
      </nav>
    </footer>
  );
}
