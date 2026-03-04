import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';

const PUBLIC_SCHEMA = 'public';
export type RealtimePostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface SubscribeToTableOptions<T> {
  event?: RealtimePostgresEvent;
  filter?: string;
  onPayload: (payload: RealtimePostgresChangesPayload<T>) => void;
}

export function subscribeToPublicTable<T>(
  tableName: string,
  options: SubscribeToTableOptions<T>,
): { channel: RealtimeChannel; unsubscribe: () => Promise<void> } {
  const { event = '*', filter, onPayload } = options;
  const channelName = `public:${tableName}:${event}:${filter ?? 'all'}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event, schema: PUBLIC_SCHEMA, table: tableName, ...(filter ? { filter } : {}) },
      onPayload,
    )
    .subscribe((status) => console.log('[realtime]', channelName, status));

  return {
    channel,
    unsubscribe: async () => {
      await supabase.removeChannel(channel);
    },
  };
}
