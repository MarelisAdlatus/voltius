import { useCallback, useEffect, useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useTeamStore } from "@/stores/teamStore";
import { useTeamObjectAccessStore } from "@/stores/teamObjectAccessStore";
import { getMyUserId } from "@/services/teamService";
import {
  resolveCan,
  EDIT_PERMISSION_OF,
  PERM_BITS,
  effectivePermissions,
  hasBuiltinRole,
  type Permission,
} from "@/services/permissions";
import type { TeamObjectType } from "@/services/teamObjects";

export { PERM_BITS, effectivePermissions, hasBuiltinRole };
export type { Permission };

// Seeds each new hook instance so a freshly opened panel doesn't render one pass without access.
let lastKnownUserId = "";

/**
 * Returns a stable `can(permission, vaultId)` checker.
 * - "personal" always returns true.
 * - Team vaults: OR all assigned role bits and check the requested bit.
 * - Returns false (pessimistic) when data is not yet loaded.
 */
export function usePermissions(): (permission: Permission, vaultId: string, objectId?: string) => boolean {
  const teams = useTeamStore((s) => s.teams);
  const membersByTeam = useTeamStore((s) => s.membersByTeam);
  const rolesByTeam = useTeamStore((s) => s.rolesByTeam);
  const loadTeams = useTeamStore((s) => s.loadTeams);
  const loadMembers = useTeamStore((s) => s.loadMembers);
  const loadRoles = useTeamStore((s) => s.loadRoles);
  const objectAccess = useTeamObjectAccessStore((s) => s.byTeam);
  const [myUserId, setMyUserId] = useState(lastKnownUserId);

  useEffect(() => {
    getMyUserId().then((id) => {
      lastKnownUserId = id ?? "";
      setMyUserId(lastKnownUserId);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (teams.length === 0) { loadTeams().catch(() => {}); return; }
    for (const team of teams) {
      if (!membersByTeam[team.id]) loadMembers(team.id).catch(() => {});
      if (!rolesByTeam[team.id]) loadRoles(team.id).catch(() => {});
    }
  }, [teams, membersByTeam, rolesByTeam, loadTeams, loadMembers, loadRoles]);

  return useCallback((permission: Permission, vaultId: string, objectId?: string): boolean => {
    return resolveCan(
      { myUserId, teams, membersByTeam, rolesByTeam, objectAccess, vaults: useVaultStore.getState().vaults },
      permission,
      vaultId,
      objectId,
    );
  }, [teams, membersByTeam, rolesByTeam, objectAccess, myUserId]);
}

/** Whether the caller may edit `object`; a not-yet-saved object is always editable. */
export function useCanEditObject(type: TeamObjectType, object?: { id: string; vault_id?: string }): boolean {
  const can = usePermissions();
  return !object || can(EDIT_PERMISSION_OF[type], object.vault_id || "personal", object.id);
}
