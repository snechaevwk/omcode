import { useAtomValue } from "@effect/atom-react";
import type { ScheduledTask } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";

import { environmentIdsKey } from "../../state/environmentAtomList";
import { useConnectedEnvironmentIds } from "../../state/environments";
import {
  ScheduledTaskRunState,
  scheduledTasksListAtom,
  scheduleLabel,
} from "../settings/ScheduledTasksSettings";

const MAX_PREVIEW_TASKS = 8;

function nextRunOrder(task: ScheduledTask) {
  return task.enabled && task.nextRunAt ? Date.parse(task.nextRunAt) : Number.POSITIVE_INFINITY;
}

// Mounted only while the tooltip is open, so the live subscription runs only on hover.
export function SidebarScheduledTasksPreview() {
  const environmentIds = useConnectedEnvironmentIds();
  const queries = useAtomValue(scheduledTasksListAtom(environmentIdsKey(environmentIds)));
  const tasks = queries
    .flatMap((query) => AsyncResult.getOrElse(query, () => null)?.tasks ?? [])
    .toSorted((left, right) => nextRunOrder(left) - nextRunOrder(right));
  const loading = queries.some((query) => query._tag === "Initial");
  const failed = queries.length > 0 && queries.every((query) => query._tag === "Failure");
  const visible = tasks.slice(0, MAX_PREVIEW_TASKS);

  return (
    <div className="w-64 py-0.5">
      <div className="mb-1 font-medium">Scheduled tasks</div>
      {visible.length > 0 ? (
        <ul className="space-y-1.5">
          {visible.map((task) => (
            <li key={task.id} className="min-w-0">
              <div className="truncate">{task.title}</div>
              <div className="truncate text-muted-foreground">
                {scheduleLabel(task.schedule)} · <ScheduledTaskRunState task={task} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-muted-foreground">
          {loading
            ? "Loading…"
            : failed
              ? "Could not load scheduled tasks"
              : environmentIds.length === 0
                ? "No connected environments"
                : "No scheduled tasks"}
        </div>
      )}
      {tasks.length > visible.length ? (
        <div className="mt-1.5 text-muted-foreground">+{tasks.length - visible.length} more</div>
      ) : null}
    </div>
  );
}
