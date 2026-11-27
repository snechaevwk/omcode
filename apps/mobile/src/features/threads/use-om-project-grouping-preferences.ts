import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useMemo } from "react";

import { mobilePreferencesAtom, saveMobilePreferences } from "../../state/preferences";
import { useAtomCommand } from "../../state/use-atom-command";

const EMPTY_KEYS: readonly string[] = [];

/**
 * OM Code: persisted project grouping for the Home list and iPad sidebar.
 * Collapsed groups reuse the `collapsedProjectGroups` preference left over
 * from the v1 sidebar.
 */
export function useOmProjectGroupingPreferences() {
  const preferencesResult = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomCommand(saveMobilePreferences);
  const loaded = AsyncResult.isSuccess(preferencesResult);
  const groupByProject = !loaded || preferencesResult.value.omThreadListGroupByProject !== false;
  const collapsedList =
    (loaded ? preferencesResult.value.collapsedProjectGroups : undefined) ?? EMPTY_KEYS;
  const collapsedKeys = useMemo(() => new Set(collapsedList), [collapsedList]);

  const toggleGroupByProject = () => {
    if (!loaded) return;
    void savePreferences({
      transform: (current) => ({
        omThreadListGroupByProject: current.omThreadListGroupByProject === false,
      }),
    });
  };
  const toggleGroupCollapsed = (groupKey: string) => {
    if (!loaded) return;
    void savePreferences({
      transform: (current) => {
        const keys = current.collapsedProjectGroups ?? EMPTY_KEYS;
        return {
          collapsedProjectGroups: keys.includes(groupKey)
            ? keys.filter((key) => key !== groupKey)
            : [...keys, groupKey],
        };
      },
    });
  };

  return { groupByProject, collapsedKeys, toggleGroupByProject, toggleGroupCollapsed } as const;
}
