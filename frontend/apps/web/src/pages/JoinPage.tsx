import { useEffect } from 'react';

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
    background: 'var(--card-bg, #1e1e1e)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '1.25rem',
    padding: '2.5rem 2rem',
    maxWidth: '360px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  },
  icon: { fontSize: '3rem', margin: '0 0 0.5rem' },
  title: { margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 700 },
  subtitle: { margin: 0, color: 'gray', fontSize: '0.95rem' },
};
import { useSearchParams, useNavigate } from 'react-router';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken, isLoading } = useAuth();
  const roomId = searchParams.get('roomId');

  useEffect(() => {
    if (!roomId || isLoading) return;

    const joinGroup = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/group/join?group_id=${roomId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        if (!res.ok) {
          const message =
            res.status === 404
              ? 'No group found.'
              : `Error joining group: ${res.statusText}`;
          navigate(`/error?message=${encodeURIComponent(message)}`);
          return;
        }

        navigate(`/profile/${roomId}`);
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
        <div style={styles.card}>
          <p style={styles.icon}>📷</p>
          <h2 style={styles.title}>No Room Found</h2>
          <p style={styles.subtitle}>Scan a QR code to join a group.</p>
        </div>
      </div>
    );

  return (
    <div style={styles.screen}>
      <div style={styles.card}>
        <p style={styles.icon}>⏳</p>
        <h2 style={styles.title}>Joining group...</h2>
        <p style={styles.subtitle}>Please wait while we connect you.</p>
      </div>
    </div>
  );
}
