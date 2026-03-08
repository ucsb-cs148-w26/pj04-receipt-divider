import { useSearchParams } from 'react-router';
import React from 'react';

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

export default function ErrorPage() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message') ?? 'No group found.';

  return (
    <div style={styles.screen}>
      <div style={styles.card}>
        <p style={styles.icon}>❌</p>
        <h2 style={styles.title}>Something went wrong</h2>
        <p style={styles.subtitle}>{message}</p>
      </div>
    </div>
  );
}
