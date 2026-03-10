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
  getUserGroups,
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
  isLoaded: boolean;
}

export const EMPTY_ENTRY: GroupEntry = {
  items: [],
  claims: [],
  members: [],
  receipts: [],
  profiles: {},
  createdBy: '',
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
): Promise<void> {
  try {
    // Supabase reads run in parallel; profiles come from the FastAPI backend.
    const [itemsRes, membersRes, receiptsRes] = await Promise.all([
      supabase.from('items').select('*').eq('group_id', groupId),
      supabase.from('group_members').select('*').eq('group_id', groupId),
      supabase.from('receipts').select('*').eq('group_id', groupId),
    ]);

    const items: Item[] = itemsRes.error ? [] : (itemsRes.data ?? []);
    const members: GroupMember[] = membersRes.error
      ? []
      : (membersRes.data ?? []);
    const receipts: Receipt[] = receiptsRes.error
      ? []
      : (receiptsRes.data ?? []);

    // Profiles fetched from FastAPI — gracefully degrade if backend is unavailable.
    const profiles: Record<string, ProfileWithColor> = {};
    let createdBy = '';
    try {
      const { profiles: list, groupCreatedBy } =
        await getGroupProfiles(groupId);
      for (const p of list) profiles[p.profileId] = p;
      createdBy = groupCreatedBy;
    } catch {
      // Backend unavailable — names will fall back to truncated profile IDs.
    }

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

    setEntries((prev) => ({
      ...prev,
      [groupId]: {
        items,
        claims,
        members,
        receipts,
        profiles,
        createdBy,
        isLoaded: true,
      },
    }));
  } catch (err) {
    console.error('[GroupCache] doFetchGroup failed for', groupId, err);
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

  // ── My Groups ──────────────────────────────────────────────────────────────

  const refetchMyGroups = useCallback(async () => {
    if (myGroupsInFlight.current) return;
    myGroupsInFlight.current = true;
    setIsLoadingMyGroups(true);
    try {
      const { groups } = await getUserGroups();
      setMyGroups(groups);
    } catch (err) {
      console.error('[GroupCache] refetchMyGroups failed:', err);
    } finally {
      myGroupsInFlight.current = false;
      setIsLoadingMyGroups(false);
    }
  }, []);

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
