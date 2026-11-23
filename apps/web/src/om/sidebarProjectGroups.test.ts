import { describe, expect, it } from "vite-plus/test";

import { buildProjectSections, groupThreadsByProject } from "./sidebarProjectGroups";

const thread = (id: string, project: string, routine = false) => ({ id, project, routine });
const groupKeyOf = (entry: { project: string }) => entry.project;
const keyOf = (entry: { id: string }) => entry.id;

describe("groupThreadsByProject", () => {
  it("orders groups by project order and keeps thread order within a group", () => {
    const groups = groupThreadsByProject(
      [thread("a1", "a"), thread("b1", "b"), thread("x1", "x"), thread("a2", "a")],
      groupKeyOf,
      ["b", "a"],
    );
    expect(groups.map((group) => [group.groupKey, group.threads.map(keyOf)])).toEqual([
      ["b", ["b1"]],
      ["a", ["a1", "a2"]],
      ["x", ["x1"]],
    ]);
  });
});

describe("buildProjectSections", () => {
  it("lists every project, splits settled and routine threads and empties collapsed sections", () => {
    const hasActiveByKey = new Map<string, boolean>();
    const sections = buildProjectSections({
      active: [
        thread("a1", "a"),
        thread("ar1", "a", true),
        thread("x1", "x"),
        thread("c1", "c"),
        thread("cr1", "c", true),
        thread("zr1", "z", true),
      ],
      settled: [thread("a2", "a"), thread("ar2", "a", true), thread("y1", "y"), thread("c2", "c")],
      groupKeyOf,
      groupOrder: ["a", "b", "c"],
      isCollapsed: (key, hasActive) => {
        hasActiveByKey.set(key, hasActive);
        return key === "c";
      },
      isRoutine: (entry) => entry.routine,
    });
    expect(
      sections.map((section) => [
        section.groupKey,
        section.active.map(keyOf),
        section.settled.map(keyOf),
        section.routines.active.map(keyOf),
        section.routines.settled.map(keyOf),
        section.collapsed,
      ]),
    ).toEqual([
      ["a", ["a1"], ["a2"], ["ar1"], ["ar2"], false],
      ["b", [], [], [], [], false],
      ["c", [], ["c2"], [], [], true],
      ["x", ["x1"], [], [], [], false],
      ["z", [], [], ["zr1"], [], false],
      ["y", [], ["y1"], [], [], false],
    ]);
    // Collapsed sections still report their active threads, so a default can
    // fold idle projects without hiding live work. A routine's run is live work.
    expect(Object.fromEntries(hasActiveByKey)).toEqual({
      a: true,
      b: false,
      c: true,
      x: true,
      z: true,
      y: false,
    });
  });
});
