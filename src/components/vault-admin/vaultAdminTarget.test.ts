import { test, expect } from "vitest";
import { vaultAdminCapabilities, type VaultAdminTarget } from "./vaultAdminTarget";
import { PERM_BITS } from "@/services/permissions";

const ownerRole = { id: "r-own", name: "owner", is_builtin: true };
const memberRole = { id: "r-mem", name: "member", is_builtin: true };
const teamsAsOwner = [{ id: "t1", role_ids: ["r-own"] }];
const teamsAsMember = [{ id: "t1", role_ids: ["r-mem"] }];
const roles = { t1: [ownerRole, memberRole] };

const privateVault: VaultAdminTarget =
  { kind: "local", vaultId: "v1", teamId: null, name: "Personal stuff" };
const teamVault: VaultAdminTarget =
  { kind: "local", vaultId: "v1", teamId: "t1", name: "My Vault" };
const personalVault: VaultAdminTarget =
  { kind: "local", vaultId: "personal", teamId: null, name: "Personal" };
const standaloneTeam: VaultAdminTarget =
  { kind: "cloud", vaultId: null, teamId: "t1", name: "Their Vault" };

test("a private local vault can be renamed and deleted, nothing else", () => {
  expect(vaultAdminCapabilities(privateVault, [], {})).toEqual({
    isTeam: false, isOwner: false, canRename: true, canDelete: true, canMakePrivate: false,
  });
});

test("the built-in personal vault can be renamed but never deleted", () => {
  expect(vaultAdminCapabilities(personalVault, [], {}).canDelete).toBe(false);
  expect(vaultAdminCapabilities(personalVault, [], {}).canRename).toBe(true);
});

test("a team vault owner can make it private again or delete it", () => {
  expect(vaultAdminCapabilities(teamVault, teamsAsOwner, roles)).toEqual({
    isTeam: true, isOwner: true, canRename: true, canDelete: true, canMakePrivate: true,
  });
});

test("only the owner may delete a team vault, as the server enforces", () => {
  expect(vaultAdminCapabilities(teamVault, teamsAsMember, roles).canDelete).toBe(false);
  expect(vaultAdminCapabilities(standaloneTeam, teamsAsMember, roles).canDelete).toBe(false);
});

test("a team vault member is not offered make-private", () => {
  const caps = vaultAdminCapabilities(teamVault, teamsAsMember, roles);
  expect(caps.isOwner).toBe(false);
  expect(caps.canMakePrivate).toBe(false);
});

test("a standalone team vault's owner can rename and delete the team", () => {
  expect(vaultAdminCapabilities(standaloneTeam, teamsAsOwner, roles)).toEqual({
    isTeam: true, isOwner: true, canRename: true, canDelete: true, canMakePrivate: false,
  });
});

test("renaming a team vault renames the team, so it needs Manage vault", () => {
  expect(vaultAdminCapabilities(teamVault, teamsAsMember, roles).canRename).toBe(false);
  const managers = { t1: [{ id: "r-mem", name: "manager", is_builtin: false, permissions: PERM_BITS.MANAGE_VAULT }] };
  expect(vaultAdminCapabilities(teamVault, teamsAsMember, managers).canRename).toBe(true);
  expect(vaultAdminCapabilities(standaloneTeam, teamsAsMember, managers).canRename).toBe(true);
});

test("a non-builtin role literally named owner does not grant ownership", () => {
  const impostor = { t1: [{ id: "r-own", name: "owner", is_builtin: false }] };
  expect(vaultAdminCapabilities(teamVault, teamsAsOwner, impostor).isOwner).toBe(false);
});

