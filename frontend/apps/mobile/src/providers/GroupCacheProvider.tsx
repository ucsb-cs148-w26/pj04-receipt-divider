/**
 * GroupCacheProvider — single source of truth for all backend/Supabase reads.
 *
 * Every screen that reads group data should go through this cache rather than
 * fetching independently.  Mutations (createGroup, claimItem, etc.) still call
 * the API directly; they trigger a cache refresh via `refetchGroup` /
 * `refetchMyGroups` as needed.
 *
 * Adding a new cacheable endpoint:
 *   1. Extend `GroupEntry` (if per-group) or add top-level state (if global).
 *   2. Fetch it inside `doFetchGroup` or a new top-level fetcher.
 *   3. Expose it via the context type and return it in `value`.
 *   4. Consume it through `useGroupCache()` in the relevant hook/screen.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/services/supabase';
import {
  getGroupProfiles,
  type GroupSummary,
  type ProfileWithColor,
} from '@/services/groupApi';
import type {
  Item,
  ItemClaim,
  GroupMember,
  Receipt,
} from '@eezy-receipt/shared';

// ─── Per-group cache entry ─────────────────────────────────────────────────────

export interface GroupEntry {
  items: Item[];
  claims: ItemClaim[];
  members: GroupMember[];
  receipts: Receipt[];
  /** profileId → ProfileWithColor (username + accentColor) */
  profiles: Record<string, ProfileWithColor>;
  /** auth user UUID of the group creator */
  createdBy: string;
  /** group name */
  username: string | null;
  isLoaded: boolean;
}

export const EMPTY_ENTRY: GroupEntry = {
  items: [],
  claims: [],
  members: [],
  receipts: [],
  profiles: {},
  createdBy: '',
  username: null,
  isLoaded: false,
};

// ─── Context type ──────────────────────────────────────────────────────────────

interface GroupCacheContextType {
  /** Home-screen list of the current user's groups */
  myGroups: GroupSummary[] | null;
  isLoadingMyGroups: boolean;
  /** Fetch (or re-fetch) the user's group list */
  refetchMyGroups: () => Promise<void>;

  /** Cache of per-group data, keyed by groupId */
  groupEntries: Record<string, GroupEntry>;
  /**
   * Fetch group data for `groupId` if a fetch is not already in flight.
   * Subsequent calls while a fetch is in-flight are silently ignored (deduped).
   */
  fetchGroup: (groupId: string) => Promise<void>;
  /**
   * Force a re-fetch of group data, bypassing the in-flight dedup guard.
   * Use this after mutations that should update the cache immediately.
   */
  refetchGroup: (groupId: string) => Promise<void>;
}

// ─── Internal fetch helper (outside component for referential stability) ───────

async function doFetchGroup(
  groupId: string,
  setEntries: React.Dispatch<React.SetStateAction<Record<string, GroupEntry>>>,
): Promise<GroupEntry | null> {
  try {
    // Supabase reads run in parallel
    const [itemsRes, membersRes, receiptsRes, groupRes] = await Promise.all([
      supabase.from('items').select('*').eq('group_id', groupId),
      supabase.from('group_members').select('*').eq('group_id', groupId),
      supabase.from('receipts').select('*').eq('group_id', groupId),
      supabase
        .from('groups')
        .select('name, created_by')
        .eq('id', groupId)
        .single(),
    ]);

    const items: Item[] = itemsRes.error ? [] : (itemsRes.data ?? []);
    const members: GroupMember[] = membersRes.error
      ? []
      : (membersRes.data ?? []);
    const receipts: Receipt[] = receiptsRes.error
      ? []
      : (receiptsRes.data ?? []);
    const groupName = groupRes.data?.name ?? null;
    const createdBy = groupRes.data?.created_by ?? '';

    // Profiles fetched from backend API (bypasses RLS)
    const profiles: Record<string, ProfileWithColor> = {};
    let profileCreatedBy = '';
    try {
      const { profiles: list, groupCreatedBy } =
        await getGroupProfiles(groupId);
      for (const p of list) profiles[p.profileId] = p;
      profileCreatedBy = groupCreatedBy;
    } catch {
      // Backend unavailable — names will fall back to truncated profile IDs.
    }

    // Use createdBy from Supabase if available, otherwise from backend
    const finalCreatedBy = createdBy || profileCreatedBy;

    // Claims depend on item IDs
    const itemIds = items.map((i) => i.id);
    let claims: ItemClaim[] = [];
    if (itemIds.length > 0) {
      const claimsRes = await supabase
        .from('item_claims')
        .select('*')
        .in('item_id', itemIds);
      if (!claimsRes.error) claims = claimsRes.data ?? [];
    }

    const entry: GroupEntry = {
      items,
      claims,
      members,
      receipts,
      profiles,
      createdBy: finalCreatedBy,
      username: groupName,
      isLoaded: true,
    };
    setEntries((prev) => ({ ...prev, [groupId]: entry }));
    return entry;
  } catch (err) {
    console.error('[GroupCache] doFetchGroup failed for', groupId, err);
    return null;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

const GroupCacheContext = createContext<GroupCacheContextType | undefined>(
  undefined,
);

export function useGroupCache(): GroupCacheContextType {
  const ctx = useContext(GroupCacheContext);
  if (!ctx) {
    throw new Error('useGroupCache must be used within <GroupCacheProvider>');
  }
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

export function GroupCacheProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [myGroups, setMyGroups] = useState<GroupSummary[] | null>(null);
  const [isLoadingMyGroups, setIsLoadingMyGroups] = useState(false);
  const [groupEntries, setGroupEntries] = useState<Record<string, GroupEntry>>(
    {},
  );

  // Ref-based guards prevent duplicate concurrent fetches.
  const myGroupsInFlight = useRef(false);
  const groupsInFlight = useRef<Set<string>>(new Set());

  // Clear the entire cache whenever the user signs out or switches accounts
  // so the next user never sees stale data from a previous session.
  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setMyGroups(null);
        setGroupEntries({});
        myGroupsInFlight.current = false;
        groupsInFlight.current.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── My Groups ──────────────────────────────────────────────────────────────

  async function fetchMyGroupsMetadata(
    profileId: string,
  ): Promise<Map<string, { name: string | null; paidStatus: string }>> {
    const { data: groupMembers, error: gmError } = await supabase
      .from('group_members')
      .select('group_id, paid_status')
      .eq('profile_id', profileId);

    if (gmError || !groupMembers) return new Map();

    const groupIds = groupMembers.map((gm) => gm.group_id);
    if (groupIds.length === 0) return new Map();

    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name')
      .in('id', groupIds);

    const metadata = new Map<
      string,
      { name: string | null; paidStatus: string }
    >();

    if (!groupsError && groups) {
      const groupNameMap = new Map(groups.map((g) => [g.id, g.name]));
      for (const gm of groupMembers) {
        metadata.set(gm.group_id, {
          name: groupNameMap.get(gm.group_id) ?? null,
          paidStatus: gm.paid_status,
        });
      }
    }

    return metadata;
  }

  function computeMyGroupsFromEntries(
    entries: Record<string, GroupEntry>,
    metadata: Map<string, { name: string | null; paidStatus: string }>,
    profileId: string,
  ): GroupSummary[] {
    const summaries: GroupSummary[] = [];

    // Only iterate groups the user currently belongs to (from metadata).
    // This ensures deleted groups and other users' groups never appear.
    for (const [groupId, meta] of metadata.entries()) {
      const entry = entries[groupId];
      if (!entry?.isLoaded) continue;

      const name = meta.name ?? entry.username ?? null;
      const paidStatus =
        (meta.paidStatus as GroupSummary['paidStatus']) || 'unrequested';

      const memberCount = entry.members.length;

      const itemMap = new Map(entry.items.map((i) => [i.id, i]));

      let totalClaimed = 0;
      for (const claim of entry.claims) {
        if (claim.profile_id === profileId) {
          const item = itemMap.get(claim.item_id);
          if (item) {
            totalClaimed += item.unit_price * claim.share;
          }
        }
      }

      const receiptCreatedBy = new Set(entry.receipts.map((r) => r.created_by));
      let totalUploaded = 0;
      for (const item of entry.items) {
        if (item.receipt_id && receiptCreatedBy.has(profileId)) {
          totalUploaded += item.unit_price * item.amount;
        }
      }

      summaries.push({
        groupId,
        name,
        memberCount,
        totalClaimed,
        totalUploaded,
        paidStatus,
      });
    }

    return summaries;
  }

  const refetchMyGroups = useCallback(async () => {
    if (myGroupsInFlight.current) return;
    myGroupsInFlight.current = true;
    setIsLoadingMyGroups(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMyGroups([]);
        return;
      }

      const metadata = await fetchMyGroupsMetadata(user.id);
      const groupIds = Array.from(metadata.keys());

      const missingGroupIds = groupIds.filter(
        (id) => !groupEntries[id]?.isLoaded,
      );

      const fetchResults = await Promise.all(
        missingGroupIds.map((id) => doFetchGroup(id, setGroupEntries)),
      );

      // Build a merged snapshot so summary computation sees the freshly
      // fetched entries, not the stale closure captured before the awaits.
      const freshEntries: Record<string, GroupEntry> = { ...groupEntries };
      missingGroupIds.forEach((id, idx) => {
        const entry = fetchResults[idx];
        if (entry) freshEntries[id] = entry;
      });

      const groups = computeMyGroupsFromEntries(
        freshEntries,
        metadata,
        user.id,
      );
      setMyGroups(groups);
    } catch (err) {
      console.error('[GroupCache] refetchMyGroups failed:', err);
    } finally {
      myGroupsInFlight.current = false;
      setIsLoadingMyGroups(false);
    }
  }, [groupEntries]);

  // ── Per-group data ─────────────────────────────────────────────────────────

  const fetchGroup = useCallback(async (groupId: string) => {
    if (!groupId || groupsInFlight.current.has(groupId)) return;
    groupsInFlight.current.add(groupId);
    try {
      await doFetchGroup(groupId, setGroupEntries);
    } finally {
      groupsInFlight.current.delete(groupId);
    }
  }, []);

  const refetchGroup = useCallback(
    async (groupId: string) => {
      groupsInFlight.current.delete(groupId); // bypass dedup
      await fetchGroup(groupId);
    },
    [fetchGroup],
  );

  const value = useMemo<GroupCacheContextType>(
    () => ({
      myGroups,
      isLoadingMyGroups,
      refetchMyGroups,
      groupEntries,
      fetchGroup,
      refetchGroup,
    }),
    [
      myGroups,
      isLoadingMyGroups,
      refetchMyGroups,
      groupEntries,
      fetchGroup,
      refetchGroup,
    ],
  );

  return (
    <GroupCacheContext.Provider value={value}>
      {children}
    </GroupCacheContext.Provider>
  );
}
