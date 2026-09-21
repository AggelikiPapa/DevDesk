import { useState } from "react";
import { BottomNavigation } from "./components/BottomNavigation";
import { CurrentTask } from "./components/CurrentTask";
import { TaskList } from "./components/TaskList";
import { currentTask, otherTasks } from "./features/task-preview/mockData";
import { reorderTasks } from "./features/task-preview/reorderTasks";

export default function App() {
  const [tasks, setTasks] = useState(otherTasks);
  return (
    <div className="app-shell">
      <main>
        <CurrentTask task={currentTask} />
        <TaskList tasks={tasks} onReorder={(source, target) =>
          setTasks((previous) => reorderTasks(previous, source, target))} />
      </main>
      <BottomNavigation />
    </div>
  );
}
