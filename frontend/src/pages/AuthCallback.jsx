// src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);

      const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
      const hashParams = new URLSearchParams(hash);
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        window.history.replaceState({}, '', url.origin + url.pathname);
      }

      const hasCode = url.searchParams.get('code');
      if (!access_token && !refresh_token && hasCode) {
        await supabase.auth.exchangeCodeForSession(url.toString());
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/login');

      const res = await fetch('/api/register/confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) return navigate('/login?confirm=failed');

      navigate('/');
    })();
  }, [navigate]);

  return <p>Signing you in…</p>;
}
