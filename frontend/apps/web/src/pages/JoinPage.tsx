import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useAuth } from '../providers/AuthProvider';

const API_URL = import.meta.env.VITE_API_URL as string;

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const roomId = searchParams.get('roomId');

  useEffect(() => {
    if (!roomId || isLoading || !accessToken) return;

    fetch(`${API_URL}/group/join?group_id=${roomId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to join group (${res.status})`);
        navigate(`/group/${roomId}`);
      })
      .catch((err: Error) => setError(err.message));
  }, [roomId, isLoading, accessToken, navigate]);

  if (!roomId) return <p>Scan a QR code to join a group.</p>;
  if (error) return <p>Error: {error}</p>;
  return <p>Joining group...</p>;
}
