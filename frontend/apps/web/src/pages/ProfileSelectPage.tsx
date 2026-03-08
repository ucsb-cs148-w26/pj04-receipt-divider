import React, { useState } from 'react';

interface ParticipantTab {
  id: number;
  name: string;
}

const AVATAR_COLORS = [
  '#7C9FC9',
  '#C97C7C',
  '#7CC97C',
  '#C9B87C',
  '#9C7CC9',
  '#7CC9C9',
  '#C97CB8',
  '#C9937C',
  '#7C8FC9',
  '#A0C97C',
];

function getColor(id: number) {
  return AVATAR_COLORS[(id - 1) % AVATAR_COLORS.length];
}

const MOCK_PARTICIPANTS: ParticipantTab[] = [
  { id: 1, name: 'Warden Creations' },
  { id: 2, name: '6sly' },
];

let nextId = MOCK_PARTICIPANTS.length + 1;

export default function ProfileSelectPage() {
  const [participants, setParticipants] =
    useState<ParticipantTab[]>(MOCK_PARTICIPANTS);
  const [selectedId, setSelectedId] = useState<number | null>(
    MOCK_PARTICIPANTS[0]?.id ?? null,
  );

  const handleAdd = () => {
    const newParticipant: ParticipantTab = { id: nextId++, name: '' };
    setParticipants((prev) => [...prev, newParticipant]);
    setSelectedId(newParticipant.id);
  };

  const selected = participants.find((p) => p.id === selectedId);

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Who are you?</h2>
      <div style={styles.selectorWrapper}>
        {participants.map((p) => {
          const color = getColor(p.id);
          const isSelected = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              style={{
                ...styles.card,
                borderColor: isSelected ? color : 'transparent',
                boxShadow: isSelected
                  ? '0 2px 8px rgba(0,0,0,0.10)'
                  : '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <div
                style={{
                  ...styles.topBar,
                  background: color,
                  opacity: isSelected ? 1 : 0.45,
                }}
              />
              <div style={styles.cardContent}>
                <div style={{ ...styles.avatar, background: color }}>
                  <span style={styles.avatarText}>{p.id}</span>
                </div>
                <span style={styles.name}>{p.name || `Name ${p.id}`}</span>
              </div>
            </button>
          );
        })}
        <button
          onClick={handleAdd}
          style={styles.addCard}
          aria-label='Add participant'
        >
          <div style={{ ...styles.topBar, background: '#e5e7eb' }} />
          <div style={styles.addContent}>
            <span style={styles.addIcon}>+</span>
          </div>
        </button>
      </div>
      <div style={styles.content}>
        {selected ? (
          <p style={styles.placeholder}>
            Viewing items for:{' '}
            <strong>{selected.name || `Name ${selected.id}`}</strong>
          </p>
        ) : (
          <p style={styles.placeholder}>Select a participant above.</p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 700,
    margin: '0 auto',
    padding: '24px 16px',
    fontFamily: 'system-ui, sans-serif',
    boxSizing: 'border-box',
    width: '100%',
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 16,
    color: '#111827',
  },
  selectorWrapper: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    border: '2px solid transparent',
    borderRadius: 12,
    minWidth: 140,
    cursor: 'pointer',
    padding: 0,
    overflow: 'hidden',
    transition: 'box-shadow 0.15s, border-color 0.15s',
  },
  topBar: { height: 6, width: '100%' },
  cardContent: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px 12px 12px',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1 },
  name: {
    fontWeight: 600,
    fontSize: 14,
    color: '#1a202c',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  addCard: {
    display: 'flex',
    flexDirection: 'column',
    background: '#f3f4f6',
    border: '2px dashed #d1d5db',
    borderRadius: 12,
    minWidth: 56,
    cursor: 'pointer',
    padding: 0,
    overflow: 'hidden',
  },
  addContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 14px 12px',
  },
  addIcon: { fontSize: 26, color: '#9ca3af', fontWeight: 300, lineHeight: 1 },
  content: {
    background: '#f9fafb',
    borderRadius: 12,
    padding: 24,
    marginTop: 16,
    minHeight: 160,
  },
  placeholder: { color: '#6b7280', fontSize: 16 },
};
