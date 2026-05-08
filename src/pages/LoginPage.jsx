import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import { branding } from '../lib/branding.config';

const inputStyle = {
  width: '100%',
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: '13px 16px',
  color: T.text,
  fontSize: 14,
  marginBottom: 18,
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.2s',
  fontFamily: "'DM Sans', sans-serif",
};

const labelStyle = {
  fontSize: 11,
  color: T.muted,
  letterSpacing: 1,
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 6,
  fontFamily: "'DM Sans', sans-serif",
};

export default function LoginPage({ initialMessage }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFade(true), 100);
    return () => clearTimeout(t);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (authError) {
      const msg =
        authError.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos.'
          : authError.message;
      setError(msg);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.dark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Cormorant Garamond', Georgia, serif",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          textAlign: 'center',
          maxWidth: 360,
          padding: '0 24px',
          width: '100%',
          opacity: fade ? 1 : 0,
          transform: fade ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s ease',
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 300,
            color: T.gold,
            letterSpacing: 6,
            marginBottom: 4,
            textTransform: 'uppercase',
          }}
        >
          {branding.appName}
        </div>
        <div
          style={{
            fontSize: 12,
            color: T.muted,
            letterSpacing: 8,
            textTransform: 'uppercase',
            marginBottom: 56,
          }}
        >
          {branding.appCategory}
        </div>

        <div
          style={{
            fontSize: 11,
            color: T.muted,
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          Panel de control
        </div>

        {initialMessage && (
          <div
            style={{
              color: T.muted,
              fontSize: 12,
              marginBottom: 16,
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.5,
            }}
          >
            {initialMessage}
          </div>
        )}

        <div style={{ textAlign: 'left' }}>
          <label htmlFor="login-email" style={labelStyle}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = T.gold)}
            onBlur={(e) => (e.target.style.borderColor = T.border)}
          />
          <label htmlFor="login-password" style={labelStyle}>
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, marginBottom: 24 }}
            onFocus={(e) => (e.target.style.borderColor = T.gold)}
            onBlur={(e) => (e.target.style.borderColor = T.border)}
          />
        </div>

        {error && (
          <div
            style={{
              color: T.red,
              fontSize: 12,
              marginBottom: 16,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            background: T.gold,
            color: T.dark,
            border: 'none',
            borderRadius: 10,
            padding: '14px',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: 'uppercase',
            cursor: submitting ? 'wait' : 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'opacity 0.2s, transform 0.1s',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
