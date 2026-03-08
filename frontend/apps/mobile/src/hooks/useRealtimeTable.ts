import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  subscribeToPublicTable,
  type RealtimePostgresEvent,
} from '@/services/realtime';

export interface UseRealtimeTableOptions<T> {
  event?: RealtimePostgresEvent;
  filter?: string;
}

export function useRealtimeTable<T>(
  tableName: string,
  onPayload: (payload: RealtimePostgresChangesPayload<T>) => void,
  options: UseRealtimeTableOptions<T> = {},
) {
  const { event = '*', filter } = options;
  const onPayloadRef = useRef(onPayload);
  onPayloadRef.current = onPayload;

  useEffect(() => {
    const { unsubscribe } = subscribeToPublicTable<T>(tableName, {
      event,
      filter,
      onPayload: (payload) => onPayloadRef.current(payload),
    });
    return () => {
      void unsubscribe();
    };
  }, [tableName, event, filter]);
}

export interface UseRealtimeRefetchOptions {
  event?: RealtimePostgresEvent;
  filter?: string;
}

export function useRealtimeRefetch(
  tableName: string,
  refetch: () => void | Promise<void>,
  options: UseRealtimeRefetchOptions = {},
) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useRealtimeTable(
    tableName,
    () => {
      void refetchRef.current();
    },
    options,
  );
}
