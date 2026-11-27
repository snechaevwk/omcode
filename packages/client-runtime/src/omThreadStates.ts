/**
 * Per-state thread counts for project group headers (OM Code fork feature),
 * shared by web and mobile. Each client maps its own row status onto these.
 */
export type OmThreadState = "approval" | "input" | "working" | "failed" | "ready";

/** Display order: what needs the user first, idle work last. */
export const OM_THREAD_STATE_ORDER: ReadonlyArray<OmThreadState> = [
  "approval",
  "input",
  "working",
  "failed",
  "ready",
];

/**
 * Maps a row status onto a header bucket. Waiting on background work counts
 * as working, a guest's request as input and a usage limit as failed: each
 * needs that bucket's attention.
 */
export function omThreadStateOf(
  status: OmThreadState | "waiting" | "preparing" | "request" | "limited",
): OmThreadState {
  if (status === "waiting" || status === "preparing") return "working";
  if (status === "request") return "input";
  if (status === "limited") return "failed";
  return status;
}

export type OmThreadStateCounts = Readonly<Record<OmThreadState, number>>;

export function countThreadStates(states: Iterable<OmThreadState>): OmThreadStateCounts {
  const counts = { approval: 0, input: 0, working: 0, failed: 0, ready: 0 };
  for (const state of states) counts[state] += 1;
  return counts;
}

export function threadStateCountsEqual(a: OmThreadStateCounts, b: OmThreadStateCounts): boolean {
  return OM_THREAD_STATE_ORDER.every((state) => a[state] === b[state]);
}

const STATE_DESCRIPTIONS: Record<OmThreadState, string> = {
  approval: "waiting for approval",
  input: "waiting for input",
  working: "working",
  failed: "failed",
  ready: "ready",
};

/** `2 waiting for approval, 1 working`; the colors carry this visually. */
export function describeThreadStateCounts(counts: OmThreadStateCounts): string {
  return OM_THREAD_STATE_ORDER.filter((state) => counts[state] > 0)
    .map((state) => `${counts[state]} ${STATE_DESCRIPTIONS[state]}`)
    .join(", ");
}
