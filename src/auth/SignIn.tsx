import { useEffect, useId, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Link, navigate } from '../router';
import { Wordmark } from '../ui/Wordmark';
import { useAuth } from './AuthContext';

type Mode = 'signin' | 'register';

function Field({ label, type = 'text', value, onChange, autoComplete, autoFocus, hint, children }: { label: string; type?: string; value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean; hint?: string; children?: ReactNode }) {
  const id = useId();
  return <div className="field">
    <input id={id} type={type} value={value} placeholder=" " autoComplete={autoComplete} autoFocus={autoFocus} required onChange={e => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined}/>
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}
  </div>;
}

export default function SignIn() {
  const { signIn, register, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setError(''); }, [mode]);
  useEffect(() => { document.title = mode === 'signin' ? 'Sign in — Podium' : 'Create your studio — Podium'; return () => { document.title = 'Podium — Rehearse in a room that reacts'; }; }, [mode]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (mode === 'signin') await signIn(email, password);
      else await register(name, email, password);
      navigate('/studio', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }

  return <div className="auth">
    <div className="auth-stage" onPointerMove={e => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--sx', `${((e.clientX - r.left) / r.width) * 100}%`);
      e.currentTarget.style.setProperty('--sy', `${((e.clientY - r.top) / r.height) * 100}%`);
    }}>
      <div className="auth-beam" aria-hidden="true"/>
      <div className="auth-rows" aria-hidden="true">{Array.from({ length: 6 }, (_, r) => <div key={r} style={{ '--r': r } as CSSProperties}>{Array.from({ length: 14 }, (_, i) => <i key={i}/>)}</div>)}</div>
      <Link to="/" className="auth-back"><ArrowLeft size={16}/>Back</Link>
      <div className="auth-quote">
        <span className="mono">Backstage</span>
        <h1 className="display-md">{mode === 'signin' ? <>Welcome back to <em className="serif">the stage.</em></> : <>Your room is <em className="serif">waiting.</em></>}</h1>
        <p className="lede">Every rehearsal you run is saved to your studio — pace, fillers and reflections, ready for the next run.</p>
      </div>
      <div className="auth-foot mono"><span>72 seats</span><span>0 recordings</span><span>1 podium</span></div>
    </div>

    <main className="auth-panel">
      <div className="auth-card">
        <Link to="/" className="auth-brand" aria-label="Podium home"><Wordmark/></Link>
        <div className="segmented" role="tablist" aria-label="Account">
          <button role="tab" type="button" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>Sign in</button>
          <button role="tab" type="button" aria-selected={mode === 'register'} onClick={() => setMode('register')}>Create account</button>
          <span className="segmented-thumb" style={{ transform: `translateX(${mode === 'signin' ? 0 : 100}%)` }} aria-hidden="true"/>
        </div>
        <h2>{mode === 'signin' ? 'Sign in to your studio' : 'Create your studio'}</h2>
        <p className="auth-sub">{mode === 'signin' ? 'Pick up where your last rehearsal left off.' : 'Takes ten seconds. No credit card, no recordings.'}</p>

        <form onSubmit={submit} noValidate={false}>
          {mode === 'register' && <Field label="Your name" value={name} onChange={setName} autoComplete="name" autoFocus/>}
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" autoFocus={mode === 'signin'}/>
          <Field label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={setPassword} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} hint={mode === 'register' ? 'At least 8 characters.' : undefined}>
            <button type="button" className="field-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </Field>
          <div className="form-error" role="alert" aria-live="assertive">{error}</div>
          <button className="btn btn-lime btn-lg btn-block" type="submit" disabled={busy}>
            {busy ? <><LoaderCircle size={18} className="spin"/>{mode === 'signin' ? 'Signing in…' : 'Creating…'}</> : <>{mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowRight size={18}/></>}
          </button>
        </form>

        <div className="divider"><span>or</span></div>
        <button type="button" className="btn btn-ghost btn-lg btn-block" onClick={() => { continueAsGuest(); navigate('/studio', { replace: true }); }}>Continue as guest</button>
        <p className="auth-fine">Guest sessions are saved only in this browser. Your password is hashed on the Podium server; audio is never recorded.</p>
      </div>
    </main>
  </div>;
}
