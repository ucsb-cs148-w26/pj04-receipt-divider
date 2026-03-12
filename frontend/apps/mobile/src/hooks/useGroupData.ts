import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGroupCache, EMPTY_ENTRY } from '@/providers/GroupCacheProvider';
import { useRealtimeRefetch } from './useRealtimeTable';

/**
 * Hook that returns cached group data for the given groupId and keeps it fresh
 * via Supabase Realtime subscriptions.
 *
 * Data is stored in GroupCacheProvider so it survives navigation — screens that
 * return to the same groupId get instant renders without a loading spinner.
 *
 * Returned `profiles` is a map of profileId → ProfileWithColor (username +
 * accentColor) fetched from the FastAPI backend alongside the Supabase data.
 */
export function useGroupData(groupId: string) {
  const { groupEntries, fetchGroup, refetchGroup } = useGroupCache();
  const entry = groupEntries[groupId] ?? EMPTY_ENTRY;
  console.log('Test: ', groupEntries[groupId]?.profiles);
  const filter = useMemo(() => `group_id=eq.${groupId}`, [groupId]);

  // Trigger an initial fetch (or background refresh if already loaded).
  // fetchGroup is deduped — concurrent calls for the same groupId are no-ops.
  useEffect(() => {
    if (groupId) void fetchGroup(groupId);
  }, [groupId, fetchGroup]);

  // Immediate refetch — used by the returned `refetch` so pull-to-refresh feels instant.
  const refetch = useCallback(() => {
    void refetchGroup(groupId);
  }, [refetchGroup, groupId]);

  // Debounced refetch — used for realtime events so that rapid-fire DB change
  // notifications (e.g. from a bulk claim/unclaim touching N rows) collapse
  // into a single cache refresh instead of N parallel fetches.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefetch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void refetchGroup(groupId);
    }, 300);
  }, [refetchGroup, groupId]);

  useRealtimeRefetch('items', debouncedRefetch, { filter });
  useRealtimeRefetch('item_claims', debouncedRefetch);
  useRealtimeRefetch('group_members', debouncedRefetch, { filter });
  useRealtimeRefetch('receipts', debouncedRefetch, { filter });
  useRealtimeRefetch('payment_debts', debouncedRefetch, { filter });
  // profiles: fires when a new guest's username is set after anonymous sign-in,
  // ensuring the participant list updates on all clients (especially when a
  // guest is created from the web profile-select page).
  useRealtimeRefetch('profiles', debouncedRefetch);

  return {
    items: entry.items,
    claims: entry.claims,
    members: entry.members,
    receipts: entry.receipts,
    debtStatuses: entry.debtStatuses,
    profiles: entry.profiles,
    createdBy: entry.createdBy,
    isFinished: entry.isFinished,
    isLoaded: entry.isLoaded,
    hasError: entry.hasError,
    refetch,
  };
}
