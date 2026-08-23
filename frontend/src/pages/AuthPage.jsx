import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { exchangeOAuthCode, getOAuthStartUrl } from '../services/authService';
import { getDisplayError } from '../services/apiErrors';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const redirectTo = location.state?.from || '/app/overview';
  const oauthRedirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI || `${window.location.origin}/auth`;

  const decodeOAuthState = (stateToken) => {
    try {
      const parts = stateToken.split('.');
      if (parts.length < 2) return null;
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(payload)
          .split('')
          .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join('')
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const code = search.get('code');
    const state = search.get('state');
    const provider = search.get('provider') || search.get('oauth');

    if (!code || !state) {
      return;
    }

    const completeOAuth = async () => {
      try {
        const statePayload = decodeOAuthState(state);
        const providerFromState = statePayload?.provider;
        const redirectUriFromState = statePayload?.redirect_uri;
        const resolvedProvider = provider || providerFromState;
        const resolvedRedirectUri = redirectUriFromState || oauthRedirectUri;

        setOauthLoading(resolvedProvider || 'oauth');
        setError('');
        if (!resolvedProvider) {
          throw new Error('OAuth callback provider is missing. Try signing in again.');
        }

        const result = await exchangeOAuthCode({
          provider: resolvedProvider,
          code,
          state,
          redirectUri: resolvedRedirectUri
        });

        await signIn({ email: result.user.email, password: 'oauth-session', mode: 'login', directSession: result });
        navigate(redirectTo, { replace: true });
      } catch (err) {
        setError(getDisplayError(err, 'OAuth authentication failed.'));
      } finally {
        setOauthLoading('');
      }
    };

    completeOAuth();
  }, [location.search, oauthRedirectUri, navigate, redirectTo, signIn]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.includes('@') || password.length < 8) {
      setError('Use a valid email and strong password (8+ chars, upper/lower/digit).');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await signIn({ email, password, mode });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const startOAuth = async (provider) => {
    try {
      setError('');
      setOauthLoading(provider);
      const { auth_url } = await getOAuthStartUrl(provider, oauthRedirectUri);
      window.location.href = auth_url;
    } catch (err) {
      setError(getDisplayError(err, `Unable to start ${provider} OAuth.`));
      setOauthLoading('');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div className="grid-hero pointer-events-none absolute inset-0 opacity-70" />
      <div className="particle-layer" />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#101018]/85 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="grid md:grid-cols-[1.1fr_0.9fr]">
          <div className="relative border-b border-white/10 p-7 md:border-b-0 md:border-r md:p-10">
            <div className="pointer-events-none absolute -top-10 left-0 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
            <p className="sg-kicker">ShadowGraph Access</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">Secure your identity intelligence workspace</h1>
            <p className="mt-5 text-sm leading-7 text-muted md:text-base">
              Authenticate to launch cinematic dashboard views, run module scans, and manage your personalized risk monitoring profile.
            </p>
            <div className="mt-8 grid gap-3">
              {['Consent-first workflows', 'Professional-grade visibility', 'Cross-module evidence trail'].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-surface/60 px-4 py-3 text-sm text-muted">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <motion.form onSubmit={submit} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="p-7 md:p-10">
            <p className="sg-kicker">{mode === 'login' ? 'Returning User' : 'New Operator'}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
            <p className="mt-2 text-sm text-muted">Use credentials or trusted OAuth providers.</p>

            <div className="mt-6 space-y-3">
              <input
                className={`sg-input ${error ? 'border-red-400/60' : ''}`}
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                className={`sg-input ${error ? 'border-red-400/60' : ''}`}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error ? <p className="text-xs text-red-300">{error}</p> : null}
              <button disabled={loading} className="sg-button-primary flex w-full items-center justify-center gap-2">
                {loading ? <LoadingSpinner /> : null}
                {loading ? 'Authenticating...' : mode === 'login' ? 'Login' : 'Create Account'}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => startOAuth('google')} className="sg-button-secondary px-3 py-2.5 text-sm">
                {oauthLoading === 'google' ? 'Redirecting...' : 'Google'}
              </button>
              <button type="button" onClick={() => startOAuth('github')} className="sg-button-secondary px-3 py-2.5 text-sm">
                {oauthLoading === 'github' ? 'Redirecting...' : 'GitHub'}
              </button>
            </div>

            <p className="mt-4 text-sm text-muted">
              {mode === 'login' ? 'No account?' : 'Already registered?'}{' '}
              <button type="button" className="text-cyan hover:text-accent" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Sign up' : 'Login'}
              </button>
            </p>
            <Link to="/" className="mt-2 block text-xs text-muted hover:text-text">
              Back to landing
            </Link>
          </motion.form>
        </div>
      </motion.div>
    </div>
  );
}
