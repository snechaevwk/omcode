import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { planProjectRemoval } from "@t3tools/client-runtime/state/projects";
import { mapAtomCommandResult, settlePromise } from "@t3tools/client-runtime/state/runtime";

import { useComposerDraftStore } from "../../composerDraftStore";
import {
  checkProjectAccess,
  reportProjectFailure,
  useProjectGroupUpdate,
  type ProjectGroupUpdate,
} from "../../hooks/useProjectGroupUpdate";
import { releaseProjectDraftUploads } from "../../lib/composerDraftUploads";
import { readLocalApi } from "../../localApi";
import {
  type SidebarProjectGroupMember,
  type SidebarProjectSnapshot,
} from "../../sidebarProjectGrouping";
import { readThreadShells, waitForProjectRemoval } from "../../state/entities";
import { readUnloadedThreadCount } from "../../state/olderSettledShelf";
import { projectEnvironment } from "../../state/projects";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { toastManager } from "../ui/toast";
import { projectGroupTitleNeedsUpdate } from "./ProjectSettingsPanel.logic";

type ProjectGroup = Pick<SidebarProjectSnapshot, "displayName" | "memberProjects">;

/**
 * Project-group edits shared by the project settings page and the sidebar
 * project menu. Failures surface as toasts; removal asks for confirmation.
 */
export function useProjectGroupCommands() {
  const { updateProjectGroup, canOrganizeProjectGroup } = useProjectGroupUpdate();
  const deleteProject = useOrchestrationCommand(projectEnvironment.delete, {
    reportFailure: false,
  });

  const updateAllMembers = (
    group: ProjectGroup,
    input: ProjectGroupUpdate | ((member: SidebarProjectGroupMember) => ProjectGroupUpdate),
    failureTitle: string,
  ) => updateProjectGroup(group.memberProjects, input, failureTitle);

  const renameGroup = async (group: ProjectGroup, nextTitle: string, wasEdited: boolean) => {
    const title = nextTitle.trim();
    if (!title) {
      toastManager.add({ type: "warning", title: "Project title cannot be empty" });
      return;
    }
    if (
      !projectGroupTitleNeedsUpdate(
        group.memberProjects.map((member) => member.title),
        title,
        wasEdited,
      )
    ) {
      return;
    }
    await updateAllMembers(group, { title }, "Failed to rename project");
  };

  /**
   * Removes `members` of `group` after a confirm dialog. `hasOtherMembers`
   * means the group has members outside the ones the caller is showing.
   * Resolves true once every member is removed.
   */
  const removeMembers = async (
    group: ProjectGroup,
    members: ReadonlyArray<SidebarProjectGroupMember>,
    hasOtherMembers: boolean,
  ): Promise<boolean> => {
    if (checkProjectAccess(members, "Failed to remove project")) return false;
    const api = readLocalApi();
    if (!api) return false;

    const threads = readThreadShells();
    const { projectThreads, confirmationMessage } = planProjectRemoval({
      members,
      groupMemberCount: group.memberProjects.length,
      hasOtherMembers,
      displayName: group.displayName,
      threads,
      unloadedThreadCount: readUnloadedThreadCount(members, threads),
    });
    const confirmed = await settlePromise(() =>
      api.dialogs.confirm(confirmationMessage, { variant: "destructive" }),
    );
    if (confirmed._tag === "Failure" || !confirmed.value) return false;
    if (checkProjectAccess(members, "Failed to remove project")) return false;

    const draftStore = useComposerDraftStore.getState();
    for (const member of members) {
      if (checkProjectAccess([member], "Failed to remove project")) return false;
      const memberThreads = projectThreads.filter(
        (thread) => thread.environmentId === member.environmentId && thread.projectId === member.id,
      );
      const result = mapAtomCommandResult(
        await deleteProject({
          environmentId: member.environmentId,
          input: {
            projectId: member.id,
            force: true,
          },
        }),
        () => undefined,
      );
      if (result._tag === "Failure") {
        reportProjectFailure(`Failed to remove "${member.title}"`, result);
        return false;
      }
      const projectRef = scopeProjectRef(member.environmentId, member.id);
      await waitForProjectRemoval(projectRef);
      releaseProjectDraftUploads(
        projectRef,
        memberThreads.map((thread) => scopeThreadRef(thread.environmentId, thread.id)),
      );
      const projectDraftThread = draftStore.getDraftThreadByProjectRef(projectRef);
      if (projectDraftThread) {
        draftStore.clearDraftThread(projectDraftThread.draftId);
      }
      draftStore.clearProjectDraftThreadId(projectRef);
    }
    return true;
  };

  return { updateAllMembers, renameGroup, removeMembers, canOrganizeProjectGroup };
}
