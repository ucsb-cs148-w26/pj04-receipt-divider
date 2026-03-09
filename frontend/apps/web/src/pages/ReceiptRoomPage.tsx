import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router';
import { supabase } from '../services/supabase';
import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Item {
  id: string;
  name: string;
  amount: number;
  unit_price: number;
}

interface Participant {
  profileId: string;
  name: string;
  color: string;
}

// claims: item_id -> profile_id[]
type ClaimsMap = Record<string, string[]>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeProfileId(token: string | null): string | null {
  if (!token) return null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    return (JSON.parse(atob(padded)) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReceiptRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [claims, setClaims] = useState<ClaimsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Read the profile JWT saved by ProfileSelectPage. Stored in sessionStorage so
  // it survives tab switches (anon session refreshes won't overwrite it).
  const profileJwt = useMemo(
    () =>
      roomId ? (sessionStorage.getItem(`profileJwt:${roomId}`) ?? null) : null,
    [roomId],
  );
  const profileId = useMemo(() => decodeProfileId(profileJwt), [profileJwt]);

  const channelsRef = useRef<RealtimeChannel[]>([]);

  const t = {
    bg: '#f9fafb',
    card: '#ffffff',
    border: 'rgba(0,0,0,0.08)',
    text: '#111827',
    sub: '#6b7280',
  };

  // Authed Supabase client using the profile JWT from sessionStorage.
  // Not tied to accessToken so anon session refreshes don't invalidate it.
  const authedClient = useMemo<SupabaseClient>(() => {
    if (!profileJwt) return supabase;
    return createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      {
        global: { headers: { Authorization: `Bearer ${profileJwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }, [profileJwt]);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchAll = useCallback(async () => {
    if (!roomId) return;

    const [itemsRes] = await Promise.all([
      authedClient
        .from('items')
        .select('id,name,amount,unit_price')
        .eq('group_id', roomId),
    ]);

    const fetchedItems: Item[] = itemsRes.data ?? [];
    setItems(fetchedItems);

    const itemIds = fetchedItems.map((i) => i.id);
    if (itemIds.length > 0) {
      const claimsRes = await authedClient
        .from('item_claims')
        .select('item_id,profile_id')
        .in('item_id', itemIds);
      const map: ClaimsMap = {};
      for (const c of claimsRes.data ?? []) {
        if (!map[c.item_id]) map[c.item_id] = [];
        map[c.item_id].push(c.profile_id);
      }
      setClaims(map);
    } else {
      setClaims({});
    }

    setIsLoading(false);
  }, [roomId, authedClient]);

  // Fetch participants from backend (has usernames + colors)
  const fetchParticipants = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/group/profiles?group_id=${roomId}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const profiles: {
        profileId: string;
        accentColor: string;
        username: string;
      }[] = data.profiles ?? [];
      setParticipants(
        profiles.map((p) => ({
          profileId: p.profileId,
          name: p.username || p.profileId.slice(0, 6),
          color: p.accentColor || '#7C9FC9',
        })),
      );
    } catch {
      // silently ignore
    }
  }, [roomId]);

  useEffect(() => {
    void fetchAll();
    void fetchParticipants();
  }, [fetchAll, fetchParticipants]);

  // ---------------------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!roomId) return;
    const filter = `group_id=eq.${roomId}`;

    const itemsCh = supabase
      .channel(`items:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter },
        () => void fetchAll(),
      )
      .subscribe();

    const claimsCh = supabase
      .channel(`item_claims:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_claims' },
        () => void fetchAll(),
      )
      .subscribe();

    const membersCh = supabase
      .channel(`group_members:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter },
        () => {
          void fetchAll();
          void fetchParticipants();
        },
      )
      .subscribe();

    channelsRef.current = [itemsCh, claimsCh, membersCh];
    return () => {
      channelsRef.current.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [roomId, fetchAll, fetchParticipants]);

  // ---------------------------------------------------------------------------
  // Claim / Unclaim
  // ---------------------------------------------------------------------------

  const toggleClaim = async (itemId: string) => {
    const jwt = profileJwt;
    if (!jwt || !profileId || claimingId) return;
    const isClaimed = (claims[itemId] ?? []).includes(profileId);
    setClaimingId(itemId);
    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/group/item/${isClaimed ? 'unclaim' : 'claim'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ item_id: itemId }),
        },
      );
      await fetchAll();
    } finally {
      setClaimingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const myTotal = items.reduce((sum, item) => {
    const c = claims[item.id] ?? [];
    if (!profileId || !c.includes(profileId)) return sum;
    return sum + (item.unit_price * item.amount) / c.length;
  }, 0);

  const myItemCount = items.filter(
    (item) => profileId && (claims[item.id] ?? []).includes(profileId),
  ).length;

  const me = participants.find((p) => p.profileId === profileId);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div
        style={{
          ...styles.screen,
          background: t.bg,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p style={{ color: t.sub, fontFamily: 'system-ui, sans-serif' }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...styles.screen, background: t.bg }}>
      {/* Header */}
      <div style={styles.header}>
        <span style={{ ...styles.roomLabel, color: t.text }}>Room</span>
        <span style={styles.roomId}>{roomId}</span>
      </div>

      {/* Items */}
      <div style={styles.itemList}>
        {items.length === 0 ? (
          <div
            style={{
              ...styles.emptyCard,
              background: t.card,
              borderColor: t.border,
            }}
          >
            <p
              style={{
                color: t.sub,
                margin: 0,
                fontFamily: 'system-ui, sans-serif',
                fontSize: 15,
              }}
            >
              No items yet. The host will add them from the mobile app.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const price = item.unit_price * item.amount;
            const itemClaims = claims[item.id] ?? [];
            const isClaimed = !!profileId && itemClaims.includes(profileId);
            const isBusy = claimingId === item.id;

            return (
              <div
                key={item.id}
                style={{ ...styles.itemCardWrapper, paddingBottom: 14 }}
              >
                <div
                  style={{
                    ...styles.itemCard,
                    background: t.card,
                    borderColor: isClaimed ? '#4999DF' : t.border,
                    borderWidth: 2,
                    boxShadow:
                      hoveredId === item.id
                        ? '0 4px 16px rgba(0,0,0,0.14)'
                        : '0 1px 4px rgba(0,0,0,0.06)',
                    opacity: isBusy ? 0.6 : 1,
                  }}
                  onClick={() => void toggleClaim(item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Claim indicator */}
                  <div
                    style={{
                      ...styles.claimIcon,
                      background: isClaimed ? '#4999DF' : 'transparent',
                      color: isClaimed ? '#fff' : 'transparent',
                      border: isClaimed ? 'none' : '2px solid rgba(0,0,0,0.15)',
                    }}
                  >
                    {isClaimed ? '✓' : ''}
                  </div>

                  <div style={styles.itemMiddle}>
                    <span style={{ ...styles.itemName, color: t.text }}>
                      {item.name}
                    </span>
                  </div>

                  <div style={styles.itemRight}>
                    <span style={{ ...styles.price, color: t.text }}>
                      ${price.toFixed(2)}
                    </span>
                    <span
                      style={{
                        ...styles.splitPrice,
                        visibility:
                          itemClaims.length > 1 ? 'visible' : 'hidden',
                      }}
                    >
                      ${(price / itemClaims.length).toFixed(2)} ea
                    </span>
                  </div>
                </div>

                {/* Tags */}
                <div style={styles.tagsRow}>
                  {itemClaims.map((pid) => {
                    const p = participants.find((p) => p.profileId === pid);
                    const name = p?.name ?? pid.slice(0, 1).toUpperCase();
                    const color = p?.color ?? '#9ca3af';
                    return (
                      <div
                        key={pid}
                        style={{ ...styles.tag, background: color }}
                      >
                        <span style={styles.tagText}>
                          {name[0].toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* My profile card */}
      <div style={{ ...styles.participantsSection, background: t.card }}>
        <div style={styles.participantCard}>
          <div
            style={{
              ...styles.participantBar,
              background: me?.color ?? '#7C9FC9',
            }}
          />
          <div style={styles.participantBody}>
            <div
              style={{
                ...styles.participantAvatar,
                background: me?.color ?? '#7C9FC9',
              }}
            >
              <span style={styles.participantInitial}>
                {me ? me.name[0].toUpperCase() : '?'}
              </span>
            </div>
            <div style={styles.participantInfo}>
              <span style={{ ...styles.participantName, color: t.text }}>
                {me?.name ?? 'You'}
              </span>
              <span style={styles.participantCount}>
                {myItemCount} item{myItemCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={styles.participantTotalBlock}>
              <span style={styles.participantTotalLabel}>My total</span>
              <span style={{ ...styles.participantTotal, color: t.text }}>
                ${myTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif',
    boxSizing: 'border-box',
    overflow: 'hidden',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
  },
  header: {
    padding: '20px 16px 8px 16px',
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    flexShrink: 0,
  },
  roomLabel: { fontSize: 26, fontWeight: 700 },
  roomId: { fontSize: 12, color: '#9ca3af' },
  itemList: {
    flex: 1,
    padding: '8px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as const,
  },
  itemCardWrapper: {
    flexShrink: 0,
    position: 'relative',
    marginBottom: 0,
  },
  itemCard: {
    border: '1px solid',
    borderRadius: 16,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    transition: 'box-shadow 0.15s, border-color 0.15s',
    minHeight: 56,
  },
  emptyCard: {
    border: '1px solid',
    borderRadius: 16,
    padding: 24,
    textAlign: 'center',
  },
  itemMiddle: { flex: 1, display: 'flex', alignItems: 'center' },
  itemName: { fontSize: 18, fontWeight: 600 },
  tagsRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    position: 'absolute',
    bottom: 4,
    left: 16,
  },
  tag: {
    width: 28,
    height: 28,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: { color: '#fff', fontSize: 13, fontWeight: 700 },
  itemRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 0,
  },
  price: { fontSize: 18, fontWeight: 600 },
  splitPrice: { fontSize: 13, color: '#9ca3af' },
  claimIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    boxSizing: 'border-box' as const,
    flexShrink: 0,
    marginTop: 4,
  },
  participantsSection: {
    borderTop: '1px solid rgba(0,0,0,0.06)',
    padding: '12px 16px 24px',
    flexShrink: 0,
  },
  participantCard: {
    background: '#f9fafb',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  participantBar: { height: 6, width: '100%' },
  participantBody: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  participantInitial: { color: '#fff', fontWeight: 700, fontSize: 16 },
  participantInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  participantName: { fontSize: 17, fontWeight: 700 },
  participantCount: { fontSize: 14, color: '#9ca3af' },
  participantTotalBlock: {
    marginLeft: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    paddingRight: 4,
  },
  participantTotalLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  participantTotal: { fontSize: 22, fontWeight: 700 },
};
