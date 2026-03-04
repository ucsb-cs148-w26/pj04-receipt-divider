# Supabase Realtime

## useRealtimeTable (single table)

```tsx
import { useRealtimeTable } from '@/hooks';

useRealtimeTable('receipts', (payload) => {
  if (payload.eventType === 'INSERT') {}
  if (payload.eventType === 'UPDATE') {}
  if (payload.eventType === 'DELETE') {}
});

useRealtimeTable('items', onPayload, { event: 'INSERT' });
useRealtimeTable('receipts', onPayload, { filter: 'group_id=eq.xxx-xxx' });
```

## subscribeToPublicTable (manual)

```ts
import { subscribeToPublicTable } from '@/services/realtime';

const { unsubscribe } = subscribeToPublicTable('receipts', {
  event: '*',
  onPayload: (payload) => {},
});
```

## Refetch on event (realtime sync)

Subscribe to a table and refetch your data on any INSERT/UPDATE/DELETE:

```tsx
import { useRealtimeRefetch } from '@/hooks';
import { supabase } from '@/services/supabase';
import { useCallback, useEffect, useState } from 'react';

function useGroupItems(groupId: string) {
  const [items, setItems] = useState<Item[]>([]);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('group_id', groupId);
    setItems(data ?? []);
  }, [groupId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useRealtimeRefetch('items', refetch, { filter: `group_id=eq.${groupId}` });

  return { items, refetch };
}
```

Same pattern for `item_claims` or `receipts`: pass the same `refetch` you use after load, and optionally `filter: 'group_id=eq.${groupId}'` so you only refetch when that group’s rows change.

Public tables: receipts, items, item_claims, groups, group_members, users, users_public_info.

---

## 怎么测试 Realtime 是否 OK

1. **准备数据**  
   Supabase Dashboard → Table Editor → `groups` 表里至少有一条记录，记下该行的 `id`（uuid）。  
   同组下在 `items` / `receipts` / `group_members` 里最好也有数据（`group_id` = 该 id）。

2. **进 Receipt Room（带 group id）**  
   用该 UUID 作为 roomId 进入 receipt-room（例如从 QR 或 deep link：`/receipt-room?roomId=你的uuid`）。  
   列表和参与者应显示该 group 在 DB 里的 items、group_members。

3. **看终端 log**  
   运行 `npx expo start` 的终端里应出现：  
   `[realtime] public:items:*:group_id=eq.xxx SUBSCRIBED` 等。  
   若没有 `SUBSCRIBED`：检查网络、EXPO_PUBLIC_SUPABASE_URL/ANON_KEY、表是否在 Database → Replication 里勾选。

4. **验证自动刷新**  
   保持 receipt-room 打开，在 Supabase Table Editor 里对该 group 的 `items` 改一条或增/删一条。  
   几秒内页面列表应自动更新。

5. **RLS**  
   若列表一直是 0 且 Table Editor 里有数据，需给 `items` / `group_members` / `receipts`（及 `item_claims` 如用到）加 policy，允许当前用户 SELECT。
