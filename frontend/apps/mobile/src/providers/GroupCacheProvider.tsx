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
  PaymentDebt,
  Receipt,
} from '@eezy-receipt/shared';

// ─── Per-group cache entry ─────────────────────────────────────────────────────

export interface GroupEntry {
  items: Item[];
  claims: ItemClaim[];
  members: GroupMember[];
  receipts: Receipt[];
  /** All payment_debts rows for the group */
  debtStatuses: PaymentDebt[];
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
  debtStatuses: [],
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
    const [itemsRes, membersRes, receiptsRes, groupRes, debtsRes] =
      await Promise.all([
        supabase.from('items').select('*').eq('group_id', groupId),
        supabase.from('group_members').select('*').eq('group_id', groupId),
        supabase
          .from('receipts')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true }),
        supabase
          .from('groups')
          .select('name, created_by')
          .eq('id', groupId)
          .single(),
        supabase.from('payment_debts').select('*').eq('group_id', groupId),
      ]);

    const items: Item[] = itemsRes.error ? [] : (itemsRes.data ?? []);
    const members: GroupMember[] = membersRes.error
      ? []
      : (membersRes.data ?? []);
    const receipts: Receipt[] = receiptsRes.error
      ? []
      : (receiptsRes.data ?? []);
    const debtStatuses: PaymentDebt[] = debtsRes.error
      ? []
      : (debtsRes.data ?? []);
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
      debtStatuses,
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

  async function fetchMyGroupsMetadata(profileId: string): Promise<
    Map<
      string,
      {
        name: string | null;
        paidStatus: string;
        createdAt: string | null;
        isFinished: boolean;
      }
    >
  > {
    const { data: groupMembers, error: gmError } = await supabase
      .from('group_members')
      .select('group_id') // paid_status removed from group_members
      .eq('profile_id', profileId);

    if (gmError || !groupMembers) return new Map();

    const groupIds = groupMembers.map((gm) => gm.group_id);
    if (groupIds.length === 0) return new Map();

    // Fetch group metadata and this user's debt records in parallel
    const [groupsResult, debtsResult] = await Promise.all([
      supabase
        .from('groups')
        .select('id, name, created_at, is_finished')
        .in('id', groupIds),
      supabase
        .from('payment_debts')
        .select('group_id, paid_status')
        .eq('debtor_id', profileId)
        .in('group_id', groupIds),
    ]);

    // Compute aggregate paid_status per group (worst status wins)
    const priorityOf = (s: string): number => {
      if (s === 'unrequested') return 4;
      if (s === 'requested') return 3;
      if (s === 'pending') return 2;
      return 1; // verified
    };
    const statusFromPriority = (p: number): string => {
      if (p >= 4) return 'unrequested';
      if (p === 3) return 'requested';
      if (p === 2) return 'pending';
      return 'verified';
    };
    const debtPriorityMap = new Map<string, number>();
    for (const debt of debtsResult.data ?? []) {
      const current = debtPriorityMap.get(debt.group_id) ?? 0;
      const p = priorityOf(debt.paid_status as string);
      if (p > current) debtPriorityMap.set(debt.group_id, p);
    }

    const metadata = new Map<
      string,
      {
        name: string | null;
        paidStatus: string;
        createdAt: string | null;
        isFinished: boolean;
      }
    >();

    if (!groupsResult.error && groupsResult.data) {
      const groupDataMap = new Map(groupsResult.data.map((g) => [g.id, g]));
      for (const gm of groupMembers) {
        const g = groupDataMap.get(gm.group_id);
        const priority = debtPriorityMap.get(gm.group_id) ?? 0;
        metadata.set(gm.group_id, {
          name: g?.name ?? null,
          paidStatus: statusFromPriority(priority),
          createdAt: g?.created_at ?? null,
          isFinished: g?.is_finished ?? false,
        });
      }
    }

    return metadata;
  }

  function computeMyGroupsFromEntries(
    entries: Record<string, GroupEntry>,
    metadata: Map<
      string,
      {
        name: string | null;
        paidStatus: string;
        createdAt: string | null;
        isFinished: boolean;
      }
    >,
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

      // A debt record exists only when a status has been explicitly set, so
      // "all paid" = all records that exist are verified (empty = no one has
      // requested payment yet, which is also a valid "settled" baseline).
      const allMembersPaid =
        entry.debtStatuses.length > 0 &&
        entry.debtStatuses.every((d) => d.paid_status === 'verified');

      let totalClaimed = 0;
      for (const claim of entry.claims) {
        if (claim.profile_id === profileId) {
          const item = itemMap.get(claim.item_id);
          if (item) {
            totalClaimed += item.unit_price * claim.share;
          }
        }
      }

      const myReceiptIds = new Set(
        entry.receipts
          .filter((r) => r.created_by === profileId)
          .map((r) => r.id),
      );
      const myItemIds = new Set(
        entry.items
          .filter(
            (item) => item.receipt_id && myReceiptIds.has(item.receipt_id),
          )
          .map((item) => item.id),
      );
      // Members who have verified their payment to me (I am the creditor)
      const verifiedMemberIds = new Set(
        entry.debtStatuses
          .filter(
            (d) => d.creditor_id === profileId && d.paid_status === 'verified',
          )
          .map((d) => d.debtor_id),
      );
      let verifiedPaidAmount = 0;
      for (const claim of entry.claims) {
        if (
          verifiedMemberIds.has(claim.profile_id) &&
          myItemIds.has(claim.item_id)
        ) {
          const item = itemMap.get(claim.item_id);
          if (item) verifiedPaidAmount += item.unit_price * claim.share;
        }
      }
      let totalUploaded = 0;
      for (const item of entry.items) {
        if (item.receipt_id && myReceiptIds.has(item.receipt_id)) {
          totalUploaded += item.unit_price * item.amount;
        }
      }
      totalUploaded -= verifiedPaidAmount;
      // If the current user is verified in this group, they've already paid
      const effectiveTotalClaimed =
        paidStatus === 'verified' ? 0 : totalClaimed;

      summaries.push({
        groupId,
        name,
        memberCount,
        totalClaimed: effectiveTotalClaimed,
        totalUploaded,
        paidStatus,
        isFinished: meta.isFinished ?? false,
        allMembersPaid,
        createdAt: meta.createdAt ?? undefined,
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
