import {
  describeThreadStateCounts,
  OM_THREAD_STATE_ORDER,
  type OmThreadState,
  type OmThreadStateCounts,
} from "@t3tools/client-runtime/om-thread-states";
import {
  CalendarClockIcon,
  ChevronRightIcon,
  EllipsisIcon,
  ListIcon,
  ListTreeIcon,
  SquarePenIcon,
} from "lucide-react";
import { memo, useRef } from "react";
import { T, useGT } from "gt-react";

import { ProjectFavicon, type ProjectFaviconProject } from "~/components/ProjectFavicon";
import { SidebarHeaderIconButton } from "~/components/sidebar/SidebarThreadHeader";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { useSidebarGroupingStore } from "./sidebarProjectGroups";

// Same hues as the row status labels (amber approval, indigo input, sky
// working, red failed); ready recedes.
export const OM_THREAD_STATE_CLASS_NAME: Record<OmThreadState, string> = {
  approval: "text-warning-foreground",
  input: "text-indigo-600 dark:text-indigo-300",
  working: "text-sky-600 dark:text-sky-400",
  failed: "text-red-700 dark:text-red-300",
  ready: "text-sidebar-muted-foreground",
};

/** Collapsible project header above a run of Active threads. */
export const SidebarProjectGroupHeader = memo(function SidebarProjectGroupHeader(props: {
  groupKey: string;
  label: string;
  project: ProjectFaviconProject | null;
  stateCounts: OmThreadStateCounts;
  collapsed: boolean;
  /** Opens with a gap and a rule when other rows sit above it. */
  separated: boolean;
  /** Swaps the label for an inline name field. */
  renaming: boolean;
  onToggle: (groupKey: string, collapsed: boolean) => void;
  /** Starts a new thread in this project; the button shows on hover, focus, or touch. */
  onNewThread: (groupKey: string) => void;
  /** Opens this project's routines. */
  onOpenRoutines: (groupKey: string) => void;
  /** Opens the project menu at a viewport point, from the dots button or a right-click. */
  onOpenMenu: (groupKey: string, position: { x: number; y: number }) => void;
  /** Ends an inline rename; `title` is null when cancelled. */
  onRenameEnd: (groupKey: string, title: string | null) => void;
}) {
  const gt = useGT();
  const { groupKey, onToggle, onNewThread, onOpenRoutines, onOpenMenu, onRenameEnd } = props;
  // Hover-only actions; touch has no hover, so they stay visible there.
  const actionClassName =
    "pointer-events-none inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-icon-muted opacity-0 outline-hidden hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring group-hover/project-header:pointer-events-auto group-hover/project-header:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100";
  return (
    // The gap and rule make each project's rows read as their own block.
    <li
      className={cn("list-none", props.separated && "mt-4 border-t border-sidebar-border pt-2")}
      data-om-project-group={groupKey}
    >
      {props.renaming ? (
        <ProjectRenameField label={props.label} onEnd={(title) => onRenameEnd(groupKey, title)} />
      ) : (
        <div className="group/project-header relative">
          <button
            type="button"
            aria-expanded={!props.collapsed}
            onClick={() => onToggle(groupKey, !props.collapsed)}
            onContextMenu={(event) => {
              event.preventDefault();
              onOpenMenu(groupKey, { x: event.clientX, y: event.clientY });
            }}
            className="flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-sm px-1.5 text-left text-xs text-sidebar-foreground outline-hidden hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-focus-within/project-header:pr-20 group-hover/project-header:bg-sidebar-row-hover group-hover/project-header:pr-20 pointer-coarse:pr-20"
          >
            <ChevronRightIcon
              aria-hidden
              className={cn(
                "size-3 shrink-0 transition-transform",
                !props.collapsed && "rotate-90",
              )}
            />
            {props.project ? (
              <ProjectFavicon project={props.project} className="size-3.5 shrink-0" />
            ) : null}
            <span className="min-w-0 flex-1 truncate font-semibold uppercase tracking-wide">
              {props.label}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className="flex shrink-0 items-center font-mono tabular-nums"
                    aria-label={describeThreadStateCounts(props.stateCounts)}
                  />
                }
              >
                {OM_THREAD_STATE_ORDER.filter((state) => props.stateCounts[state] > 0).map(
                  (state, index) => (
                    <span key={state}>
                      {index > 0 ? (
                        <span className="text-sidebar-muted-foreground/60">/</span>
                      ) : null}
                      <span className={OM_THREAD_STATE_CLASS_NAME[state]}>
                        {props.stateCounts[state]}
                      </span>
                    </span>
                  ),
                )}
              </TooltipTrigger>
              <TooltipPopup side="top">{describeThreadStateCounts(props.stateCounts)}</TooltipPopup>
            </Tooltip>
          </button>
          <div className="absolute top-1/2 right-0.5 flex -translate-y-1/2 items-center">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={gt("New thread in {project}", { project: props.label })}
                    onClick={() => onNewThread(groupKey)}
                    className={actionClassName}
                  />
                }
              >
                <SquarePenIcon aria-hidden className="size-3.5" />
              </TooltipTrigger>
              <TooltipPopup side="top">
                <T>New thread</T>
              </TooltipPopup>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={gt("Routines in {project}", { project: props.label })}
                    aria-haspopup="dialog"
                    onClick={() => onOpenRoutines(groupKey)}
                    className={actionClassName}
                  />
                }
              >
                <CalendarClockIcon aria-hidden className="size-3.5" />
              </TooltipTrigger>
              <TooltipPopup side="top">
                <T>Routines</T>
              </TooltipPopup>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={gt("Project actions for {project}", { project: props.label })}
                    aria-haspopup="menu"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      onOpenMenu(groupKey, { x: rect.left, y: rect.bottom + 4 });
                    }}
                    className={actionClassName}
                  />
                }
              >
                <EllipsisIcon aria-hidden className="size-3.5" />
              </TooltipTrigger>
              <TooltipPopup side="top">
                <T>Project actions</T>
              </TooltipPopup>
            </Tooltip>
          </div>
        </div>
      )}
    </li>
  );
});

/** Inline project name field: Enter or blur saves, Escape cancels. */
function ProjectRenameField(props: { label: string; onEnd: (title: string | null) => void }) {
  const gt = useGT();
  const endedRef = useRef(false);
  const end = (title: string | null) => {
    if (endedRef.current) return;
    endedRef.current = true;
    props.onEnd(title);
  };
  return (
    <input
      autoFocus
      aria-label={gt("Project name")}
      defaultValue={props.label}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => end(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") end(event.currentTarget.value);
        if (event.key === "Escape") end(null);
      }}
      className="h-7 w-full rounded-sm border border-ring bg-sidebar px-1.5 text-xs font-semibold text-sidebar-foreground outline-hidden"
    />
  );
}

/** Row under a project's active threads that shows or hides its settled ones. */
export const SidebarProjectSettledToggle = memo(function SidebarProjectSettledToggle(props: {
  groupKey: string;
  count: number;
  expanded: boolean;
  onToggle: (groupKey: string) => void;
}) {
  const { groupKey, onToggle } = props;
  return (
    <li className="list-none">
      <button
        type="button"
        aria-expanded={props.expanded}
        onClick={() => onToggle(groupKey)}
        className="flex h-6 w-full cursor-pointer items-center gap-1.5 rounded-sm px-1.5 text-left text-2xs text-sidebar-muted-foreground outline-hidden hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRightIcon
          aria-hidden
          className={cn("size-3 shrink-0 transition-transform", props.expanded && "rotate-90")}
        />
        <span className="min-w-0 flex-1 truncate">
          <T>Settled</T>
        </span>
        <span className="shrink-0 font-mono tabular-nums">{props.count}</span>
      </button>
    </li>
  );
});

/** Row that shows or hides the threads this project's routines started: active runs / all runs. */
export const SidebarProjectRoutinesToggle = memo(function SidebarProjectRoutinesToggle(props: {
  groupKey: string;
  activeCount: number;
  totalCount: number;
  expanded: boolean;
  onToggle: (groupKey: string, expanded: boolean) => void;
  onManage: (groupKey: string) => void;
}) {
  const gt = useGT();
  const { groupKey, onToggle, onManage } = props;
  return (
    <li className="group/routines relative list-none">
      <button
        type="button"
        aria-expanded={props.expanded}
        onClick={() => onToggle(groupKey, !props.expanded)}
        className="flex h-6 w-full cursor-pointer items-center gap-1.5 rounded-sm px-1.5 text-left text-2xs text-sidebar-muted-foreground outline-hidden hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-hover/routines:pr-8 pointer-coarse:pr-8"
      >
        <ChevronRightIcon
          aria-hidden
          className={cn("size-3 shrink-0 transition-transform", props.expanded && "rotate-90")}
        />
        <span className="min-w-0 flex-1 truncate">
          <T>Routines</T>
        </span>
        <span
          className="shrink-0 font-mono tabular-nums"
          aria-label={gt("{activeCount} active of {totalCount} runs", {
            activeCount: props.activeCount,
            totalCount: props.totalCount,
          })}
        >
          {props.activeCount > 0 ? (
            <>
              <span className="text-sidebar-foreground">{props.activeCount}</span>
              <span className="text-sidebar-muted-foreground/60">/</span>
            </>
          ) : null}
          {props.totalCount}
        </span>
      </button>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={gt("Manage routines")}
              aria-haspopup="dialog"
              onClick={() => onManage(groupKey)}
              className="pointer-events-none absolute top-1/2 right-0.5 inline-flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-icon-muted opacity-0 outline-hidden hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring group-hover/routines:pointer-events-auto group-hover/routines:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100"
            />
          }
        >
          <CalendarClockIcon aria-hidden className="size-3" />
        </TooltipTrigger>
        <TooltipPopup side="top">
          <T>Manage routines</T>
        </TooltipPopup>
      </Tooltip>
    </li>
  );
});

/** Header button that turns project grouping of threads on and off. */
export function SidebarGroupingToggle() {
  const gt = useGT();
  const groupByProject = useSidebarGroupingStore((state) => state.groupByProject);
  const setGroupByProject = useSidebarGroupingStore((state) => state.setGroupByProject);
  const label = groupByProject ? gt("Ungroup threads") : gt("Group threads by project");
  return (
    <SidebarHeaderIconButton
      label={label}
      aria-pressed={groupByProject}
      onClick={() => setGroupByProject(!groupByProject)}
    >
      {groupByProject ? <ListTreeIcon /> : <ListIcon />}
    </SidebarHeaderIconButton>
  );
}
