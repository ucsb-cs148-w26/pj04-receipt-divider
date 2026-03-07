import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useRealtimeRefetch } from './useRealtimeTable';
import type {
  Item,
  ItemClaim,
  GroupMember,
  Receipt,
} from '@eezy-receipt/shared';

export function useGroupData(groupId: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<ItemClaim[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const filter = useMemo(() => `group_id=eq.${groupId}`, [groupId]);

  const refetch = useCallback(async () => {
    if (!groupId) return;

    const [itemsRes, membersRes, receiptsRes] = await Promise.all([
      supabase.from('items').select('*').eq('group_id', groupId),
      supabase.from('group_members').select('*').eq('group_id', groupId),
      supabase.from('receipts').select('*').eq('group_id', groupId),
    ]);

    if (!itemsRes.error) setItems(itemsRes.data ?? []);
    if (!membersRes.error) setMembers(membersRes.data ?? []);
    if (!receiptsRes.error) setReceipts(receiptsRes.data ?? []);

    const itemIds = (itemsRes.data ?? []).map((i) => i.id);
    if (itemIds.length > 0) {
      const claimsRes = await supabase
        .from('item_claims')
        .select('*')
        .in('item_id', itemIds);
      if (!claimsRes.error) setClaims(claimsRes.data ?? []);
    } else {
      setClaims([]);
    }
  }, [groupId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useRealtimeRefetch('items', refetch, { filter });
  useRealtimeRefetch('item_claims', refetch);
  useRealtimeRefetch('group_members', refetch, { filter });
  useRealtimeRefetch('receipts', refetch, { filter });

  return { items, claims, members, receipts, refetch };
}
