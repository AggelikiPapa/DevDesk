import { BottomNavigation } from "./components/BottomNavigation";
import { CurrentTask } from "./components/CurrentTask";
import { TaskList } from "./components/TaskList";
import { currentTask, otherTasks } from "./features/task-preview/mockData";

export default function App() {
  return (
    <div className="app-shell">
      <main>
        <CurrentTask task={currentTask} />
        <TaskList tasks={otherTasks} />
      </main>
      <BottomNavigation />
    </div>
  );
}
