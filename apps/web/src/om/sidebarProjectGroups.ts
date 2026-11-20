/**
 * Groups the sidebar's Active and Settled threads under project headers
 * (OM Code fork feature). Pure helpers plus a small persisted preference store; the
 * Sidebar applies them without changing how threads are classified.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "~/lib/storage";

export interface ProjectThreadGroup<T> {
  readonly groupKey: string;
  readonly threads: readonly T[];
}

/**
 * Buckets threads by project group, keeping each thread's relative order.
 * Groups follow `groupOrder` (the sidebar's project sort), and groups not in
 * it follow in first-appearance order.
 */
export function groupThreadsByProject<T>(
  threads: readonly T[],
  groupKeyOf: (thread: T) => string,
  groupOrder: readonly string[],
): ProjectThreadGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const thread of threads) {
    const key = groupKeyOf(thread);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(thread);
    else byKey.set(key, [thread]);
  }
  const rank = new Map(groupOrder.map((key, index) => [key, index]));
  return [...byKey.entries()]
    .map(([groupKey, groupThreads], appearance) => ({
      groupKey,
      threads: groupThreads,
      rank: rank.get(groupKey) ?? groupOrder.length + appearance,
    }))
    .toSorted((left, right) => left.rank - right.rank)
    .map(({ groupKey, threads: groupThreads }) => ({ groupKey, threads: groupThreads }));
}

export interface ProjectSection<T> {
  readonly groupKey: string;
  /** Active threads, empty while the section is collapsed. */
  readonly active: readonly T[];
  /** Settled threads, kept apart so the section can tuck them away. */
  readonly settled: readonly T[];
  /** Threads a routine started, kept out of `active` and `settled`; empty while collapsed. */
  readonly routines: { readonly active: readonly T[]; readonly settled: readonly T[] };
  readonly collapsed: boolean;
}

/**
 * One section per project, every project included even without threads, so
 * the sidebar always lists them. Sections follow `groupOrder`; projects
 * that only show up on threads follow in first-appearance order, active
 * threads first. Collapsing a section hides all of its rows.
 */
export function buildProjectSections<T>(input: {
  readonly active: readonly T[];
  readonly settled: readonly T[];
  readonly groupKeyOf: (thread: T) => string;
  readonly groupOrder: readonly string[];
  /** Whether a section is folded, given whether it has active threads. */
  readonly isCollapsed: (groupKey: string, hasActive: boolean) => boolean;
  /** Threads a routine started go to the section's Routines group. */
  readonly isRoutine?: (thread: T) => boolean;
}): ProjectSection<T>[] {
  const keys = [...input.groupOrder];
  const known = new Set(keys);
  const isRoutine = input.isRoutine ?? (() => false);
  const bucket = (threads: readonly T[]) => {
    const byKey = new Map<string, { threads: T[]; routines: T[] }>();
    for (const thread of threads) {
      const key = input.groupKeyOf(thread);
      if (!known.has(key)) {
        known.add(key);
        keys.push(key);
      }
      let entry = byKey.get(key);
      if (!entry) {
        entry = { threads: [], routines: [] };
        byKey.set(key, entry);
      }
      (isRoutine(thread) ? entry.routines : entry.threads).push(thread);
    }
    return byKey;
  };
  const activeByKey = bucket(input.active);
  const settledByKey = bucket(input.settled);
  return keys.map((groupKey) => {
    const active = activeByKey.get(groupKey) ?? { threads: [], routines: [] };
    const settled = settledByKey.get(groupKey) ?? { threads: [], routines: [] };
    const collapsed = input.isCollapsed(
      groupKey,
      active.threads.length + active.routines.length > 0,
    );
    return {
      groupKey,
      active: collapsed ? [] : active.threads,
      settled: settled.threads,
      routines: collapsed
        ? { active: [], settled: [] }
        : { active: active.routines, settled: settled.routines },
      collapsed,
    };
  });
}

interface SidebarGroupingState {
  groupByProject: boolean;
  /**
   * Explicit fold choices. Projects without one start collapsed when they
   * have no active threads, so idle projects take a single row.
   */
  collapsedGroupKeys: Record<string, boolean>;
  setGroupByProject: (enabled: boolean) => void;
  setGroupCollapsed: (groupKey: string, collapsed: boolean) => void;
  /** Sections showing their settled threads. Not persisted: settled starts hidden. */
  expandedSettledGroupKeys: Record<string, true>;
  toggleSettledExpanded: (groupKey: string) => void;
  /**
   * Explicit Routines fold choices. Not persisted: without one, Routines opens
   * while a routine's thread is still active, so a fresh run is not hidden.
   */
  routinesExpandedGroupKeys: Record<string, boolean>;
  setRoutinesExpanded: (groupKey: string, expanded: boolean) => void;
}

export const useSidebarGroupingStore = create<SidebarGroupingState>()(
  persist(
    (set) => ({
      groupByProject: true,
      collapsedGroupKeys: {},
      expandedSettledGroupKeys: {},
      routinesExpandedGroupKeys: {},
      setGroupByProject: (enabled) => set({ groupByProject: enabled }),
      setGroupCollapsed: (groupKey, collapsed) =>
        set((state) => ({
          collapsedGroupKeys: { ...state.collapsedGroupKeys, [groupKey]: collapsed },
        })),
      toggleSettledExpanded: (groupKey) =>
        set((state) => {
          const { [groupKey]: wasExpanded, ...rest } = state.expandedSettledGroupKeys;
          return {
            expandedSettledGroupKeys: wasExpanded ? rest : { ...rest, [groupKey]: true },
          };
        }),
      setRoutinesExpanded: (groupKey, expanded) =>
        set((state) => ({
          routinesExpandedGroupKeys: { ...state.routinesExpandedGroupKeys, [groupKey]: expanded },
        })),
    }),
    {
      name: "omcode:sidebar-grouping:v1",
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({
        groupByProject: state.groupByProject,
        collapsedGroupKeys: state.collapsedGroupKeys,
      }),
    },
  ),
);
