import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router';
import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@/providers/AuthContext';

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
// Theme
// ---------------------------------------------------------------------------

function useColorScheme() {
  const [dark, setDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
}

const light = {
  bg: '#f9fafb',
  card: '#ffffff',
  border: 'rgba(0,0,0,0.08)',
  text: '#111827',
  sub: '#6b7280',
  participantCard: '#f3f4f6',
  sectionBorder: '1px solid rgba(0,0,0,0.06)',
  claimBorder: 'rgba(0,0,0,0.15)',
};

const dark = {
  bg: '#111827',
  card: '#1f2937',
  border: 'rgba(255,255,255,0.08)',
  text: '#f9fafb',
  sub: '#9ca3af',
  participantCard: '#111827',
  sectionBorder: '1px solid rgba(255,255,255,0.08)',
  claimBorder: 'rgba(255,255,255,0.35)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const STYLE_ID = 'receipt-room-styles';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes pulse-ring {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);
}

export default function ReceiptGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [claims, setClaims] = useState<ClaimsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set());
  const { sessionToken, logout } = useAuth();

  const profileId = useMemo(
    () => decodeProfileId(sessionToken),
    [sessionToken],
  );

  const channelsRef = useRef<RealtimeChannel[]>([]);
  // Ref mirror of claimingIds so realtime callbacks always see the current set
  // without capturing a stale closure.
  const claimingIdsRef = useRef<Set<string>>(new Set());
  // Latest desired state per item while in-flight (true = claimed, false = unclaimed).
  // Allows sequential toggling to queue a follow-up without a second parallel request.
  const desiredStateRef = useRef<Record<string, boolean>>({});

  const isDark = useColorScheme();
  const t = isDark ? dark : light;

  // Authed Supabase client using the profile JWT from sessionStorage.
  // Not tied to accessToken so anon session refreshes don't invalidate it.
  // realtime.setAuth is required so the WebSocket connection also uses the
  // profile JWT (global.headers only applies to HTTP requests).
  const authedClient = useMemo<SupabaseClient>(() => {
    const client = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      {
        global: { headers: { Authorization: `Bearer ${sessionToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    client.realtime.setAuth(sessionToken);
    return client;
  }, [sessionToken]);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------
  const fetchAll = useCallback(async () => {
    if (!groupId) return;

    const [itemsRes] = await Promise.all([
      authedClient
        .from('items')
        .select('id,name,amount,unit_price')
        .eq('group_id', groupId),
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
      // Sort each array so tag order is deterministic and matches optimistic state
      for (const key of Object.keys(map)) map[key].sort();
      setClaims(map);
    } else {
      setClaims({});
    }

    setIsLoading(false);
  }, [groupId, authedClient]);

  // Fetch participants from backend (has usernames + colors)
  const fetchParticipants = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/group/profiles?group_id=${groupId}`,
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
  }, [groupId]);

  useEffect(() => {
    // fetchAll/fetchParticipants are async – setState only runs after promise
    // resolution, never synchronously in this effect body. The v7 rule does not
    // distinguish sync from async setState calls, so this is a false positive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchParticipants();
  }, [fetchAll, fetchParticipants]);

  // ---------------------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!groupId) return;
    const filter = `group_id=eq.${groupId}`;

    const itemsCh = authedClient
      .channel(`items:${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        () => void fetchAll(),
      )
      .subscribe();

    const claimsCh = authedClient
      .channel(`item_claims:${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_claims' },
        // Suppress while optimistic updates are in-flight to avoid overwriting them
        () => {
          if (claimingIdsRef.current.size === 0) void fetchAll();
        },
      )
      .subscribe();

    const membersCh = authedClient
      .channel(`group_members:${groupId}`)
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
      channelsRef.current.forEach((ch) => void authedClient.removeChannel(ch));
    };
  }, [groupId, fetchAll, fetchParticipants, authedClient]);

  // ---------------------------------------------------------------------------
  // Claim / Unclaim
  // ---------------------------------------------------------------------------

  const toggleClaim = async (itemId: string) => {
    const jwt = sessionToken;
    if (!jwt || !profileId) return;

    const isClaimed = (claims[itemId] ?? []).includes(profileId);
    const newDesired = !isClaimed;

    // Optimistic update
    setClaims((prev) => {
      const list = prev[itemId] ?? [];
      const updated = newDesired
        ? list.includes(profileId)
          ? list
          : [...list, profileId].sort()
        : list.filter((id) => id !== profileId);
      return { ...prev, [itemId]: updated };
    });

    // Record latest intent. If already in-flight, the running sendRequest will
    // detect the changed desired state after its current fetch and send a follow-up.
    desiredStateRef.current[itemId] = newDesired;
    if (claimingIdsRef.current.has(itemId)) return;

    claimingIdsRef.current.add(itemId);
    setClaimingIds(new Set(claimingIdsRef.current));

    const clearItem = () => {
      delete desiredStateRef.current[itemId];
      claimingIdsRef.current.delete(itemId);
      setClaimingIds(new Set(claimingIdsRef.current));
    };

    const sendRequest = async (desired: boolean): Promise<void> => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/group/item/${desired ? 'claim' : 'unclaim'}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ itemId }),
          },
        );
        if (!res.ok) {
          clearItem();
          void fetchAll();
          return;
        }
        // If the desired state changed while this request was in-flight, send
        // a follow-up instead of leaving the item in the intermediate state.
        const latest = desiredStateRef.current[itemId];
        if (latest !== undefined && latest !== desired) {
          await sendRequest(latest);
        } else {
          clearItem();
        }
      } catch {
        clearItem();
        void fetchAll();
      }
    };

    void sendRequest(newDesired);
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
        <span style={{ ...styles.roomLabel, color: t.text }}>Group</span>
        <button
          onClick={() => {
            logout(groupId!);
          }}
          aria-label='Log out'
          style={{
            background: 'transparent',
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: '6px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: t.sub,
          }}
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            {/* Door */}
            <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
            {/* Arrow pointing right */}
            <polyline points='16 17 21 12 16 7' />
            <line x1='21' y1='12' x2='9' y2='12' />
          </svg>
        </button>
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
            const isBusy = claimingIds.has(item.id);

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
                      border: isBusy
                        ? '2px solid #4999DF'
                        : isClaimed
                          ? 'none'
                          : `2px solid ${t.claimBorder}`,
                      animation: isBusy
                        ? 'pulse-ring 0.8s ease-in-out infinite'
                        : 'none',
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
      <div
        style={{
          ...styles.participantsSection,
          background: t.card,
          borderTop: t.sectionBorder,
        }}
      >
        <div
          style={{ ...styles.participantCard, background: t.participantCard }}
        >
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
    padding: '12px 16px 24px',
    flexShrink: 0,
  },
  participantCard: {
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
