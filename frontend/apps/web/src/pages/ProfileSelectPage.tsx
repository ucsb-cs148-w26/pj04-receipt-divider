import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

interface ParticipantTab {
  id: number; // local index for UI (color, avatar)
  profileId: string; // real UUID from backend
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
  pageBg: 'transparent',
  heading: '#111827',
  cardBg: '#ffffff',
  cardName: '#1a202c',
  addCardBg: '#f3f4f6',
  addCardBorder: '#d1d5db',
  addIcon: '#9ca3af',
  topBarGhost: '#e5e7eb',
  contentBg: '#f9fafb',
  placeholder: '#6b7280',
  modalBg: '#ffffff',
  modalTitle: '#111827',
  inputBorder: '#d1d5db',
  inputColor: '#111827',
  cancelBg: '#f3f4f6',
  cancelColor: '#6b7280',
};

const dark = {
  pageBg: 'transparent',
  heading: '#f9fafb',
  cardBg: '#1f2937',
  cardName: '#f3f4f6',
  addCardBg: '#1f2937',
  addCardBorder: '#374151',
  addIcon: '#6b7280',
  topBarGhost: '#374151',
  contentBg: '#1f2937',
  placeholder: '#9ca3af',
  modalBg: '#111827',
  modalTitle: '#f9fafb',
  inputBorder: '#374151',
  inputColor: '#f3f4f6',
  cancelBg: '#1f2937',
  cancelColor: '#9ca3af',
};

export default function ProfileSelectPage() {
  const [participants, setParticipants] = useState<ParticipantTab[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = useColorScheme();
  const t = isDark ? dark : light;

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId');

  // Fetch real profiles on mount
  useEffect(() => {
    if (!roomId) return;
    fetch(`${import.meta.env.VITE_API_URL}/group/profiles?group_id=${roomId}`)
      .then((res) => res.json())
      .then((data: { profilesId: string[] }) => {
        const fetched = data.profilesId.map((profileId, i) => ({
          id: i + 1,
          profileId,
          name: `Person ${i + 1}`,
        }));
        setParticipants(fetched);
        if (fetched.length > 0) setSelectedId(fetched[0].id);
      })
      .catch(console.error);
  }, [roomId]);

  useEffect(() => {
    if (showModal) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showModal]);

  const handleAdd = () => {
    setNewName('');
    setShowModal(true);
  };

  const handleConfirm = async () => {
    if (!newName.trim() || !roomId) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/group/create-profile`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: roomId, username: newName.trim() }),
        },
      );
      if (!res.ok) return;
      const newId = participants.length + 1;
      const { profileId: newProfileId } = await res.json().then((d) => ({
        profileId: d.access_token, // token returned, profileId inferred from position
      }));
      const newParticipant: ParticipantTab = {
        id: newId,
        profileId: newProfileId,
        name: newName.trim(),
      };
      setParticipants((prev) => [...prev, newParticipant]);
      setSelectedId(newParticipant.id);
    } catch (e) {
      console.error(e);
    }
    setShowModal(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleConfirm();
    if (e.key === 'Escape') setShowModal(false);
  };

  const selected = participants.find((p) => p.id === selectedId);

  return (
    <div style={{ ...styles.page, background: t.pageBg }}>
      <h2 style={{ ...styles.heading, color: t.heading }}>Who are you?</h2>
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
                background: t.cardBg,
                borderColor: isSelected ? color : 'transparent',
                boxShadow: isSelected
                  ? '0 2px 8px rgba(0,0,0,0.20)'
                  : '0 1px 4px rgba(0,0,0,0.12)',
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
                <span style={{ ...styles.name, color: t.cardName }}>
                  {p.name || `Name ${p.id}`}
                </span>
              </div>
            </button>
          );
        })}
        <button
          onClick={handleAdd}
          style={{
            ...styles.addCard,
            background: t.addCardBg,
            borderColor: t.addCardBorder,
          }}
          aria-label='Add participant'
        >
          <div style={{ ...styles.topBar, background: t.topBarGhost }} />
          <div style={styles.addContent}>
            <span style={{ ...styles.addIcon, color: t.addIcon }}>+</span>
          </div>
        </button>
      </div>
      <div style={{ ...styles.content, background: t.contentBg }}>
        {selected ? (
          <p style={{ ...styles.placeholder, color: t.placeholder }}>
            Viewing items for:{' '}
            <strong style={{ color: t.heading }}>
              {selected.name || `Name ${selected.id}`}
            </strong>
          </p>
        ) : (
          <p style={{ ...styles.placeholder, color: t.placeholder }}>
            Select a participant above.
          </p>
        )}
      </div>

      <button
        style={{
          ...styles.continueBtn,
          opacity: selectedId !== null ? 1 : 0.4,
        }}
        disabled={selectedId === null}
        onClick={() => {
          if (selectedId === null) return;
          const path = roomId ? `/room/${roomId}` : '/room/preview';
          navigate(path);
        }}
      >
        Continue →
      </button>

      {/* Modal */}
      {showModal && (
        <div style={styles.overlay} onClick={() => setShowModal(false)}>
          <div
            style={{ ...styles.modal, background: t.modalBg }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ ...styles.modalTitle, color: t.modalTitle }}>
              Add Participant
            </h3>
            <input
              ref={inputRef}
              style={{
                ...styles.input,
                borderColor: t.inputBorder,
                color: t.inputColor,
                background: t.cardBg,
              }}
              placeholder='Enter name...'
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div style={styles.modalButtons}>
              <button
                style={{
                  ...styles.cancelBtn,
                  background: t.cancelBg,
                  color: t.cancelColor,
                }}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.confirmBtn,
                  opacity: newName.trim() ? 1 : 0.4,
                }}
                onClick={handleConfirm}
                disabled={!newName.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
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
    textAlign: 'center',
  },
  selectorWrapper: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    border: '2px solid transparent',
    borderRadius: 12,
    width: 160,
    minWidth: 160,
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
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  addCard: {
    display: 'flex',
    flexDirection: 'column',
    border: '2px dashed',
    borderRadius: 12,
    width: 160,
    minWidth: 160,
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
  addIcon: { fontSize: 26, fontWeight: 300, lineHeight: 1 },
  content: {
    borderRadius: 12,
    padding: 24,
    marginTop: 16,
    minHeight: 160,
  },
  placeholder: { fontSize: 16 },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    borderRadius: 16,
    padding: '24px 24px 20px',
    width: '90%',
    maxWidth: 360,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
  },
  input: {
    border: '1.5px solid',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 15,
    outline: 'none',
    fontFamily: 'system-ui, sans-serif',
  },
  modalButtons: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmBtn: {
    background: '#7C9FC9',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    cursor: 'pointer',
  },
  continueBtn: {
    marginTop: 16,
    width: '100%',
    padding: '14px 0',
    background: '#7C9FC9',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    transition: 'opacity 0.15s',
  },
};
