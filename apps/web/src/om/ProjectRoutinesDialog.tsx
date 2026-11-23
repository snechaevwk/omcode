/**
 * Per-project Routines (OM Code fork feature): the project's scheduled tasks,
 * each run starting a thread the sidebar lists under the project's Routines.
 * Reuses the scheduled task engine and editor; only the framing is ours.
 */
import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { omThreadStateOf, type OmThreadState } from "@t3tools/client-runtime/om-thread-states";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  type ScheduledTask,
} from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import {
  CalendarClockIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { create } from "zustand";

import { resolveSidebarThreadStatus } from "~/components/Sidebar.logic";
import {
  ScheduledTaskEditorDialog,
  ScheduledTaskRunState,
  scheduleLabel,
  scheduledTasksListAtom,
} from "~/components/settings/ScheduledTasksSettings";
import {
  SettingsScopeProvider,
  useSettingsScope,
} from "~/components/settings/SettingsScopeContext";
import { matchesScheduledTaskScope } from "~/components/settings/scheduledTasksSettings.logic";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu";
import { Switch } from "~/components/ui/switch";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { requestConfirmDialog } from "~/confirmDialog";
import { useNowMinute } from "~/hooks/useNowMinute";
import { useThreadShellsForProjectRefs } from "~/state/entities";
import { environmentAtomList, environmentIdsKey } from "~/state/environmentAtomList";
import { formatEnvironmentQueryError } from "~/state/query";
import { serverEnvironment } from "~/state/server";
import { readEnvironmentScope } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import { formatRelativeTimeLabel } from "~/timestampFormat";

import { OM_THREAD_STATE_CLASS_NAME } from "./SidebarProjectGroupHeader";

interface ProjectRoutinesRequest {
  /** The Settings project key, which scopes both the list and the editor. */
  readonly projectKey: string;
  readonly title: string;
}

const useRequest = create<{ request: ProjectRoutinesRequest | null; session: number }>(() => ({
  request: null,
  session: 0,
}));

/** Opens the Routines dialog for one project. */
export function openProjectRoutines(request: ProjectRoutinesRequest) {
  useRequest.setState((state) => ({ request, session: state.session + 1 }));
}

function close() {
  useRequest.setState({ request: null });
}

const ignoreScopeChange = () => {};

export function ProjectRoutinesDialogHost() {
  const request = useRequest((state) => state.request);
  const session = useRequest((state) => state.session);
  if (request === null) return null;
  return (
    <SettingsScopeProvider
      key={session}
      search={{ project: request.projectKey }}
      onChange={ignoreScopeChange}
    >
      <ProjectRoutinesDialog title={request.title} />
    </SettingsScopeProvider>
  );
}

const routineCreatePermissionsAtom = environmentAtomList(
  "om-routine-create-permissions",
  serverEnvironment.upsertScheduledTask.permissionAtom,
);

const STATE_LABELS: Record<OmThreadState, string> = {
  approval: "Waiting for approval",
  input: "Waiting for input",
  working: "Working",
  failed: "Failed",
  // The sidebar row's word for a finished run.
  ready: "Done",
};

function ProjectRoutinesDialog({ title }: { readonly title: string }) {
  const { scope, connectedEnvironments } = useSettingsScope();
  const [editor, setEditor] = useState<{
    environmentId: EnvironmentId;
    task: ScheduledTask | null;
  } | null>(null);
  const connectedIds = connectedEnvironments.map((entry) => entry.environmentId);
  const queries = useAtomValue(scheduledTasksListAtom(environmentIdsKey(connectedIds)));
  const createPermissions = useAtomValue(
    routineCreatePermissionsAtom(environmentIdsKey(connectedIds)),
  );
  const creationEnvironmentId = connectedIds.find((_id, index) => createPermissions[index]);
  const shells = useThreadShellsForProjectRefs(
    scope.members.map((member) => scopeProjectRef(member.environmentId, member.id)),
  );
  // The newest thread each routine started; a bound routine runs in its own thread.
  const latestRunByTask = new Map<string, EnvironmentThreadShell>();
  const shellById = new Map<string, EnvironmentThreadShell>();
  for (const shell of shells) {
    shellById.set(`${shell.environmentId}:${shell.id}`, shell);
    if (shell.scheduledTaskId === undefined) continue;
    const key = `${shell.environmentId}:${shell.scheduledTaskId}`;
    const latest = latestRunByTask.get(key);
    if (latest === undefined || latest.createdAt < shell.createdAt) latestRunByTask.set(key, shell);
  }

  const routines: Array<{ environmentId: EnvironmentId; task: ScheduledTask }> = [];
  const problems: string[] = [];
  let loading = false;
  for (const [index, query] of queries.entries()) {
    const environmentId = connectedIds[index]!;
    if (query._tag === "Failure") {
      problems.push(formatEnvironmentQueryError(query.cause));
      continue;
    }
    const data = AsyncResult.getOrElse(query, () => null);
    if (data === null) {
      loading = true;
      continue;
    }
    for (const task of data.tasks) {
      if (matchesScheduledTaskScope(scope, environmentId, task.projectId)) {
        routines.push({ environmentId, task });
      }
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Routines · {title}</DialogTitle>
          <DialogDescription>
            Prompts that run on a schedule. Each run starts a new thread, listed under Routines in
            this project.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {scope.kind === "unavailable" ? (
            <p className="text-sm text-muted-foreground">{scope.message}</p>
          ) : connectedIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Connect the environment this project runs on to manage its routines.
            </p>
          ) : routines.length === 0 && !loading ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarClockIcon />
                </EmptyMedia>
                <EmptyTitle>No routines yet</EmptyTitle>
                <EmptyDescription>
                  Create one to run a prompt daily, on weekdays, every few minutes, or once.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border/60">
              {routines.map(({ environmentId, task }) => (
                <RoutineRow
                  key={`${environmentId}:${task.id}`}
                  environmentId={environmentId}
                  task={task}
                  latestRun={
                    task.threadId === null
                      ? (latestRunByTask.get(`${environmentId}:${task.id}`) ?? null)
                      : (shellById.get(`${environmentId}:${task.threadId}`) ?? null)
                  }
                  onEdit={() => setEditor({ environmentId, task })}
                />
              ))}
            </ul>
          )}
          {loading ? (
            <p className="text-xs text-muted-foreground" role="status">
              Loading routines…
            </p>
          ) : null}
          {problems.map((problem) => (
            <p key={problem} className="text-xs text-destructive" role="status">
              Could not load routines: {problem}
            </p>
          ))}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>Close</DialogClose>
          <Button
            size="sm"
            disabled={creationEnvironmentId === undefined}
            onClick={() =>
              creationEnvironmentId !== undefined &&
              setEditor({ environmentId: creationEnvironmentId, task: null })
            }
          >
            <PlusIcon />
            New routine
          </Button>
        </DialogFooter>
        {/* Rendered inside the popup so it nests: closing it returns to the list. */}
        {editor ? (
          <ScheduledTaskEditorDialog
            key={`${editor.environmentId}:${editor.task?.id ?? "new"}`}
            initialEnvironmentId={editor.environmentId}
            task={editor.task}
            onClose={() => setEditor(null)}
          />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}

function LastRunLabel({ value }: { readonly value: string }) {
  // Minute tick, like ScheduledRelativeLabel; a run from this minute reads "just now".
  const nowMinute = useNowMinute();
  return formatRelativeTimeLabel(value, Date.parse(`${nowMinute}:00.000Z`));
}

function RoutineRow({
  environmentId,
  task,
  latestRun,
  onEdit,
}: {
  readonly environmentId: EnvironmentId;
  readonly task: ScheduledTask;
  readonly latestRun: EnvironmentThreadShell | null;
  readonly onEdit: () => void;
}) {
  const navigate = useNavigate();
  const canOperate = useAtomValue(
    serverEnvironment.upsertScheduledTask.permissionAtom(environmentId),
  );
  const [busy, setBusy] = useState(false);
  const toggle = useAtomCommand(serverEnvironment.setScheduledTaskEnabled, {
    label: "routine enabled",
  });
  const run = useAtomCommand(serverEnvironment.runScheduledTaskNow, { label: "routine run now" });
  const remove = useAtomCommand(serverEnvironment.deleteScheduledTask, {
    label: "routine delete",
  });
  const act = async (action: "toggle" | "run" | "delete") => {
    if (busy || !readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)) return;
    if (action === "delete") {
      const confirmed = await requestConfirmDialog(
        `Delete routine "${task.title}"?\nIt stops running. Threads it already started stay.`,
        { variant: "destructive" },
      );
      if (confirmed !== true) return;
    }
    setBusy(true);
    const result =
      action === "toggle"
        ? await toggle({ environmentId, input: { id: task.id, enabled: !task.enabled } })
        : action === "run"
          ? await run({ environmentId, input: { id: task.id } })
          : await remove({ environmentId, input: { id: task.id } });
    setBusy(false);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not update routine",
          description: String(squashAtomCommandFailure(result)),
        }),
      );
    }
  };
  const runState =
    latestRun === null ? null : omThreadStateOf(resolveSidebarThreadStatus(latestRun));
  // A failed run explains itself in its thread; a failed dispatch only on the task.
  const errorText =
    (runState === "failed" ? latestRun?.runtime?.lastError : null) ?? task.lastRunError;
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {scheduleLabel(task.schedule)} · <ScheduledTaskRunState task={task} />
        </p>
        {latestRun !== null && runState !== null ? (
          <p className="text-xs text-muted-foreground">
            <button
              type="button"
              className="cursor-pointer underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => {
                close();
                void navigate({
                  to: "/$environmentId/$threadId",
                  params: { environmentId, threadId: latestRun.id },
                });
              }}
            >
              {task.threadId === null ? "Last run" : "Runs in"}{" "}
              {task.threadId === null ? (
                <LastRunLabel value={latestRun.createdAt} />
              ) : (
                latestRun.title
              )}
            </button>
            {" · "}
            <span className={OM_THREAD_STATE_CLASS_NAME[runState]}>{STATE_LABELS[runState]}</span>
          </p>
        ) : task.lastRunAt !== null ? (
          <p className="text-xs text-muted-foreground">
            Last run <LastRunLabel value={task.lastRunAt} />
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Not run yet</p>
        )}
        {errorText ? (
          <p className="line-clamp-3 text-xs wrap-anywhere text-destructive">{errorText}</p>
        ) : null}
      </div>
      <Switch
        checked={task.enabled}
        disabled={busy || !canOperate}
        aria-label={task.enabled ? `Pause ${task.title}` : `Resume ${task.title}`}
        onCheckedChange={() => void act("toggle")}
      />
      <Menu>
        <MenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={busy || !canOperate}
              aria-label={`Actions for ${task.title}`}
            />
          }
        >
          <MoreHorizontalIcon />
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuItem onClick={onEdit}>
            <PencilIcon />
            Edit
          </MenuItem>
          {/* Webhook tasks need a request from their URL. */}
          {task.schedule.type === "webhook" ? null : (
            <MenuItem disabled={task.lastRunStatus === "running"} onClick={() => void act("run")}>
              <PlayIcon />
              Run now
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem onClick={() => void act("delete")}>
            <Trash2Icon />
            Delete
          </MenuItem>
        </MenuPopup>
      </Menu>
    </li>
  );
}
