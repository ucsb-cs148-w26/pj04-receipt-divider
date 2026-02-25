import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useAuth } from '../providers/AuthContext';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();
  const id = searchParams.get('id');

  useEffect(() => {
    if (!id || !accessToken) return;

    fetch(`http://localhost:8000/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to join group (${res.status})`);
        navigate(`/group/${id}`);
      })
      .catch((err: Error) => setError(err.message));
  }, [id, accessToken, navigate]);

  if (!id) return <p>Error: Invalid join link — missing group ID.</p>;
  if (error) return <p>Error: {error}</p>;
  return <p>Joining group...</p>;
}
