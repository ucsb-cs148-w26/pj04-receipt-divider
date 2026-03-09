import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useAuth } from '../providers/AuthContext';

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
  cardBg: '#ffffff',
  title: '#111827',
  subtitle: '#6b7280',
  border: 'rgba(0,0,0,0.06)',
};

const dark = {
  cardBg: '#1f2937',
  title: '#f9fafb',
  subtitle: '#9ca3af',
  border: 'rgba(255,255,255,0.06)',
};

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken, isLoading } = useAuth();
  const roomId = searchParams.get('roomId');
  const isDark = useColorScheme();
  const t = isDark ? dark : light;

  useEffect(() => {
    if (!roomId || isLoading) return;

    const joinGroup = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/group/validate-invite?group_id=${roomId}`,
        );

        if (!res.ok) {
          const message =
            res.status === 404
              ? 'No group found.'
              : `Error validating invite: ${res.statusText}`;
          navigate(`/error?message=${encodeURIComponent(message)}`);
          return;
        }

        navigate(`/profile?roomId=${roomId}`);
      } catch {
        navigate(
          `/error?message=${encodeURIComponent('Could not reach the server.')}`,
        );
      }
    };

    void joinGroup();
  }, [roomId, isLoading, accessToken, navigate]);

  if (!roomId)
    return (
      <div style={styles.screen}>
        <div
          style={{
            ...styles.card,
            background: t.cardBg,
            borderColor: t.border,
          }}
        >
          <p style={styles.icon}>📷</p>
          <h2 style={{ ...styles.title, color: t.title }}>No Room Found</h2>
          <p style={{ ...styles.subtitle, color: t.subtitle }}>
            Scan a QR code to join a group.
          </p>
        </div>
      </div>
    );

  return (
    <div style={styles.screen}>
      <div
        style={{ ...styles.card, background: t.cardBg, borderColor: t.border }}
      >
        <p style={styles.icon}>⏳</p>
        <h2 style={{ ...styles.title, color: t.title }}>Joining group...</h2>
        <p style={{ ...styles.subtitle, color: t.subtitle }}>
          Please wait while we connect you.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '1rem',
    boxSizing: 'border-box',
  },
  card: {
    border: '1px solid',
    borderRadius: 16,
    padding: '2.5rem 2rem',
    maxWidth: 360,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    fontFamily: 'system-ui, sans-serif',
  },
  icon: { fontSize: '3rem', margin: '0 0 0.5rem' },
  title: { margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 700 },
  subtitle: { margin: 0, fontSize: '0.95rem' },
};
