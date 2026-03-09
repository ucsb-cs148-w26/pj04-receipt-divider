import React, { useState } from 'react';
import { useParams } from 'react-router';

const MOCK_ITEMS = [
  { id: '1', name: 'Margherita Pizza', price: 14.99 },
  { id: '2', name: 'Caesar Salad', price: 9.49 },
  { id: '3', name: 'Garlic Bread', price: 4.99 },
  { id: '4', name: 'Pasta Carbonara', price: 13.99 },
  { id: '5', name: 'Sparkling Water', price: 3.49 },
  { id: '6', name: 'Tiramisu', price: 7.99 },
  { id: '7', name: 'Grilled Salmon', price: 18.99 },
  { id: '8', name: 'Bruschetta', price: 6.49 },
  { id: '9', name: 'House Wine (Glass)', price: 8.99 },
  { id: '10', name: 'Cheesecake', price: 6.99 },
];

const MOCK_PARTICIPANTS = [
  { id: 1, name: 'Alice', color: '#7C9FC9' },
  { id: 2, name: 'Bob', color: '#C97C7C' },
  { id: 3, name: 'Carol', color: '#7CC97C' },
];

export default function ReceiptRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [claims, setClaims] = useState<Record<string, number[]>>({
    '1': [2], // Margherita Pizza claimed by Bob
    '3': [2, 3], // Garlic Bread claimed by Bob and Carol
    '4': [3], // Pasta Carbonara claimed by Carol
  });
  const myId = 1; // pretend we are Alice

  const toggleClaim = (itemId: string) => {
    setClaims((prev) => {
      const current = prev[itemId] ?? [];
      if (current.includes(myId)) {
        return { ...prev, [itemId]: current.filter((id) => id !== myId) };
      }
      return { ...prev, [itemId]: [...current, myId] };
    });
  };

  return (
    <div style={styles.screen}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.roomLabel}>Room</span>
        <span style={styles.roomId}>{roomId}</span>
      </div>

      {/* Items */}
      <div style={styles.itemList}>
        {MOCK_ITEMS.map((item) => {
          const itemClaims = claims[item.id] ?? [];
          const isClaimed = itemClaims.includes(myId);

          return (
            <div
              key={item.id}
              style={{
                ...styles.itemCardWrapper,
                paddingBottom: 14,
              }}
            >
              <div
                style={{
                  ...styles.itemCard,
                  borderColor: isClaimed ? '#4999DF' : 'rgba(0,0,0,0.08)',
                  borderWidth: 2,
                  boxShadow:
                    hoveredId === item.id
                      ? '0 4px 16px rgba(0,0,0,0.14)'
                      : '0 1px 4px rgba(0,0,0,0.06)',
                }}
                onClick={() => toggleClaim(item.id)}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Claim icon on the left */}
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
                  <span style={styles.itemName}>{item.name}</span>
                </div>

                <div style={styles.itemRight}>
                  <span style={styles.price}>${item.price.toFixed(2)}</span>
                  <span
                    style={{
                      ...styles.splitPrice,
                      visibility: itemClaims.length > 1 ? 'visible' : 'hidden',
                    }}
                  >
                    ${(item.price / itemClaims.length).toFixed(2)} ea
                  </span>
                </div>
              </div>

              {/* Tags hanging below the card */}
              <div style={styles.tagsRow}>
                {itemClaims.map((pid) => {
                  const p = MOCK_PARTICIPANTS.find((p) => p.id === pid);
                  if (!p) return null;
                  return (
                    <div
                      key={pid}
                      style={{ ...styles.tag, background: p.color }}
                    >
                      <span style={styles.tagText}>{p.name[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* My profile summary */}
      {(() => {
        const me = MOCK_PARTICIPANTS.find((p) => p.id === myId)!;
        const total = MOCK_ITEMS.reduce((sum, item) => {
          const c = claims[item.id] ?? [];
          if (!c.includes(myId)) return sum;
          return sum + item.price / c.length;
        }, 0);
        const count = MOCK_ITEMS.filter((item) =>
          (claims[item.id] ?? []).includes(myId),
        ).length;
        return (
          <div style={styles.participantsSection}>
            <div style={styles.participantCard}>
              <div style={{ ...styles.participantBar, background: me.color }} />
              <div style={styles.participantBody}>
                <div
                  style={{ ...styles.participantAvatar, background: me.color }}
                >
                  <span style={styles.participantInitial}>{me.name[0]}</span>
                </div>
                <div style={styles.participantInfo}>
                  <span style={styles.participantName}>{me.name}</span>
                  <span style={styles.participantCount}>
                    {count} item{count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={styles.participantTotalBlock}>
                  <span style={styles.participantTotalLabel}>My total</span>
                  <span style={styles.participantTotal}>
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    height: '100vh',
    background: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif',
    boxSizing: 'border-box',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 16px 8px 16px',
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  roomLabel: {
    fontSize: 26,
    fontWeight: 700,
    color: '#111827',
  },
  roomId: {
    fontSize: 12,
    color: '#9ca3af',
  },
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
    background: '#ffffff',
    border: '1px solid',
    borderRadius: 16,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s, border-color 0.15s',
    minHeight: 56,
  },
  itemMiddle: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 18,
    fontWeight: 600,
    color: '#111827',
  },
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
  tagText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
  },
  itemRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 0,
  },
  price: {
    fontSize: 18,
    fontWeight: 600,
    color: '#111827',
  },
  splitPrice: {
    fontSize: 13,
    color: '#9ca3af',
  },
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
    background: '#ffffff',
    flexShrink: 0,
  },
  participantsRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  participantCard: {
    background: '#f9fafb',
    borderRadius: 16,
    overflow: 'hidden',
    minWidth: 140,
    flexShrink: 0,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  participantBar: {
    height: 6,
    width: '100%',
  },
  participantBody: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  participantInitial: {
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
  },
  participantInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  participantName: {
    fontSize: 17,
    fontWeight: 700,
    color: '#111827',
  },
  participantCount: {
    fontSize: 14,
    color: '#9ca3af',
  },
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
  participantTotal: {
    fontSize: 22,
    fontWeight: 700,
    color: '#111827',
  },
};
