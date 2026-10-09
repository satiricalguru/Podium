import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, AudioLines, BookOpen, Check, ChevronDown, Clock3, History, LogOut, MessageCircle, Mic, Presentation, Sparkles, Trash2, Users, Zap } from 'lucide-react';
import { formatTime, type InputMode, type Temperament } from '../lib/analysis';
import type { PracticeConfig, Report } from '../lib/types';
import type { User } from '../auth/AuthContext';
import { Link } from '../router';
import { Wordmark } from '../ui/Wordmark';
import { Dialog } from '../ui/Dialog';

export const scenarios = [
  { id: 'keynote', label: 'Keynote', icon: Presentation, topic: 'The power of small, consistent steps', description: 'Inspire a room with one big idea.' },
  { id: 'pitch', label: 'Pitch', icon: Zap, topic: 'An idea that changes how we work', description: 'Make a compelling case for your idea.' },
  { id: 'impromptu', label: 'Impromptu', icon: MessageCircle, topic: 'What makes a great leader?', description: 'Think on your feet. Find your point.' },
];

const moods: { id: Temperament; label: string; line: string }[] = [
  { id: 'supportive', label: 'Supportive', line: 'Friendly faces. A little encouragement.' },
  { id: 'neutral', label: 'Neutral', line: 'An attentive room, waiting to be convinced.' },
  { id: 'challenging', label: 'Challenging', line: 'A thoughtful crowd with tougher questions.' },
];

export const prettyModel = (model: string) => model.replace('gemini-', 'Gemini ').replaceAll('-', ' ');

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: ReactNode; aria?: string }[]; onChange: (v: T) => void }) {
  const index = Math.max(0, options.findIndex(o => o.value === value));
  return <div className="seg" role="radiogroup" aria-label={label} style={{ '--n': options.length, '--i': index } as CSSProperties}>
    <span className="seg-thumb" aria-hidden="true"/>
    {options.map(o => <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} aria-label={o.aria} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div>;
}

export function StudioNav({ view, user, locked, aiEnabled, onGuide, onSignOut }: { view: 'studio' | 'history'; user: User; locked: boolean; aiEnabled: boolean; onGuide: () => void; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menu.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const initial = (user.name.trim()[0] || 'P').toUpperCase();
  return <header className="snav">
    <Link to="/" className="snav-brand" aria-label="Podium home"><Wordmark/></Link>
    <nav className="snav-tabs" aria-label="Studio">
      <Link to="/studio" aria-current={view === 'studio' ? 'page' : undefined}><AudioLines size={15}/>Studio</Link>
      {locked
        ? <span className="is-disabled" aria-disabled="true" title="Available after your session"><History size={15}/>History</span>
        : <Link to="/history" aria-current={view === 'history' ? 'page' : undefined}><History size={15}/>History</Link>}
    </nav>
    <div className="snav-right">
      <span className={`chip ${aiEnabled ? 'chip-lime' : ''}`}><i/>{aiEnabled ? 'Gemini audience' : 'Local audience'}</span>
      <button type="button" className="snav-guide" onClick={onGuide}>Guide</button>
      <div className="menu" ref={menu}>
        <button type="button" className="avatar" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen(v => !v)}>{initial}</button>
        {open && <div className="menu-pop" role="menu">
          <div className="menu-who"><strong>{user.name}</strong><span>{user.guest ? 'Guest · saved in this browser' : user.email}</span></div>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onGuide(); }}><BookOpen size={15}/>Speaking guide</button>
          {user.guest && <Link to="/signin" role="menuitem" onClick={() => setOpen(false)}><Check size={15}/>Create an account</Link>}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }}><LogOut size={15}/>{user.guest ? 'Leave guest studio' : 'Sign out'}</button>
        </div>}
      </div>
    </div>
  </header>;
}

export function SetupPanel({ config, setConfig, configure, aiEnabled, aiConfigured, aiModel, aiStatus, onToggleAi, onAiHelp }: {
  config: PracticeConfig; setConfig: (fn: (prev: PracticeConfig) => PracticeConfig) => void; configure: <K extends keyof PracticeConfig>(key: K, value: PracticeConfig[K]) => void;
  aiEnabled: boolean; aiConfigured: boolean; aiModel: string; aiStatus: string; onToggleAi: () => void; onAiHelp: () => void;
}) {
  const mood = moods.find(m => m.id === config.temperament)!;
  return <section className="panel setup" aria-labelledby="setup-title">
    <div className="panel-head"><span className="mono">Pre-show</span><h2 id="setup-title">Set the scene</h2></div>
    <div className="setup-body">
      <div className="group">
        <span className="label">What are we practising?</span>
        <div className="scenario-row">{scenarios.map(s => <button type="button" key={s.id} className={`scenario ${config.scenario === s.id ? 'is-on' : ''}`} aria-pressed={config.scenario === s.id} onClick={() => setConfig(prev => ({ ...prev, scenario: s.id, topic: s.topic }))}><s.icon size={16}/>{s.label}</button>)}</div>
      </div>
      <div className="group">
        <label className="label" htmlFor="topic">Your topic</label>
        <textarea id="topic" className="input topic" value={config.topic} onChange={e => configure('topic', e.target.value)} maxLength={200} rows={2}/>
      </div>
      <div className="group">
        <div className="label-row"><span className="label">Audience size</span><span className="value">{config.audience} people</span></div>
        <Segmented label="Audience size" value={config.audience} onChange={v => configure('audience', v)} options={[24, 48, 72].map(n => ({ value: n, label: <><Users size={14}/>{n}</>, aria: `${n} audience members` }))}/>
      </div>
      <div className="group">
        <span className="label">Audience energy</span>
        <Segmented label="Audience energy" value={config.temperament} onChange={v => configure('temperament', v)} options={moods.map(m => ({ value: m.id, label: m.label }))}/>
        <p className="hint">{mood.line}</p>
      </div>
      <div className="group two">
        <div>
          <div className="label-row"><span className="label">Length</span><Clock3 size={13} className="muted"/></div>
          <Segmented label="Session length" value={config.duration} onChange={v => configure('duration', v)} options={[180, 300, 600].map(n => ({ value: n, label: `${n / 60}m`, aria: `${n / 60} minutes` }))}/>
        </div>
        <div>
          <span className="label">Input</span>
          <Segmented<InputMode> label="Practice input" value={config.mode} onChange={v => configure('mode', v)} options={[{ value: 'voice', label: <><Mic size={14}/>Voice</>, aria: 'Microphone' }, { value: 'typed', label: <><BookOpen size={14}/>Typed</>, aria: 'Typed rehearsal' }]}/>
        </div>
      </div>
      <div className={`ai-card ${aiEnabled ? 'is-on' : ''}`}>
        <div className="ai-row">
          <span className="ai-icon"><Sparkles size={17}/></span>
          <div><strong>Bring the audience to life</strong><span>{aiEnabled ? aiStatus : aiConfigured ? `${prettyModel(aiModel)} ready` : 'Let Gemini listen and respond'}</span></div>
          <button type="button" className={`switch ${aiEnabled ? 'is-on' : ''}`} role="switch" aria-checked={aiEnabled} aria-label="Enable Gemini audience" onClick={onToggleAi}><span/></button>
        </div>
        <p>{aiEnabled ? 'Transcript excerpts are sent to Google for reactions and coaching.' : aiConfigured ? 'Optional AI reactions, questions and coaching. Enabling sends transcript excerpts to Google.' : 'Local reactions are ready. Connect Gemini for content-aware questions and coaching.'}</p>
        <button type="button" className="link" onClick={onAiHelp}>About Gemini<ArrowRight size={13}/></button>
      </div>
    </div>
  </section>;
}

export function DirectorPanel({ config, cue, aiStatus, aiEnabled, questionBusy, onAsk }: { config: PracticeConfig; cue: string; aiStatus: string; aiEnabled: boolean; questionBusy: boolean; onAsk: () => void }) {
  return <section className="panel director" aria-labelledby="director-title">
    <div className="panel-head"><span className="mono">In session</span><h2 id="director-title">The director</h2></div>
    <div className="director-cue"><span className="label">Coaching cue</span><p aria-live="polite">{cue}</p></div>
    <button type="button" className="btn btn-ghost btn-block" onClick={onAsk} disabled={questionBusy}><MessageCircle size={16}/>{questionBusy ? 'Someone is thinking…' : 'Take a question from the room'}</button>
    <dl className="scene-summary">
      <div><dt>Topic</dt><dd>{config.topic}</dd></div>
      <div><dt>Room</dt><dd>{config.audience} · {config.temperament}</dd></div>
      <div><dt>Input</dt><dd>{config.mode === 'voice' ? 'Microphone' : 'Typed rehearsal'}</dd></div>
      <div><dt>Audience</dt><dd className={aiEnabled ? 'lime' : ''}>{aiEnabled ? aiStatus : 'Local reactions'}</dd></div>
    </dl>
    <p className="hint">Scene settings unlock when the session ends.</p>
  </section>;
}

export function Metric({ label, value, unit, note, children }: { label: string; value: string; unit?: string; note?: string; children?: ReactNode }) {
  return <div className="metric">
    <span className="label">{label}</span>
    <div className="metric-value"><b>{value}</b>{unit && <span>{unit}</span>}</div>
    {children}
    {note && <span className="metric-note">{note}</span>}
  </div>;
}

export function ReportDialog({ report, feedbackBusy, onClose, onExport, onAgain }: { report: Report; feedbackBusy: boolean; onClose: () => void; onExport: () => void; onAgain: () => void }) {
  const date = new Date(report.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return <Dialog title="Session reflection" eyebrow={`You took the stage · ${date}`} onClose={onClose} wide>
    <div className="report">
      <h3 className="report-topic">{report.config.topic}</h3>
      <p className="report-meta">{report.config.audience} listeners · {report.config.temperament} room · {report.config.mode === 'typed' ? 'typed rehearsal' : 'voice practice'}</p>
      <div className="report-stats">
        <div><b>{formatTime(report.metrics.seconds)}</b><span>Practice time</span></div>
        <div><b>{report.metrics.words}</b><span>Words</span></div>
        <div><b>{report.metrics.pace ?? '—'}</b><span>{report.config.mode === 'typed' ? 'No voice pace' : 'Words / min'}</span></div>
        <div><b>{report.metrics.fillers}</b><span>Filler phrases</span></div>
      </div>
      <div className={`report-source ${report.source === 'gemini' ? 'is-ai' : ''}`}><Sparkles size={13}/>{feedbackBusy ? 'Gemini is preparing your reflection…' : report.source === 'gemini' ? 'Content feedback by Gemini' : 'Local observations · no AI assessment'}{report.config.mode === 'voice' && report.metrics.seconds < 30 && <em>Short sample · preliminary</em>}</div>
      <div className="report-feedback">
        <div><span className="label"><Check size={14}/>Something to build on</span><p>{report.feedback.strength}</p></div>
        <div className="is-next"><span className="label"><ArrowRight size={14}/>One thing for next time</span><p>{report.feedback.improvement}</p></div>
      </div>
      <blockquote className="report-question"><span className="label"><MessageCircle size={14}/>A question to think about</span><p className="serif">“{report.feedback.question}”</p></blockquote>
      <details className="report-transcript"><summary>Your transcript<ChevronDown size={16}/></summary><p>{report.transcript || 'No transcript was captured in this session.'}</p></details>
      <div className="report-actions">
        <button type="button" className="btn btn-ghost" onClick={onExport}><ArrowDownToLine size={16}/>Export JSON</button>
        <button type="button" className="btn btn-lime" onClick={onAgain}>Practise again<ArrowRight size={16}/></button>
      </div>
    </div>
  </Dialog>;
}

export function GuideDialog({ onClose }: { onClose: () => void }) {
  const steps = [
    ['Make the room your own', 'Choose a topic, audience and length. A supportive room is a good place to start.'],
    ['Speak to one person', 'Start with your main idea. Add a story or example. Let a pause do some of the work.'],
    ['Find one small improvement', 'Review your reflection, choose one change, and run the same talk again.'],
  ];
  return <Dialog title="A little guidance" eyebrow="Speaking guide" onClose={onClose}>
    <p className="dialog-lead serif">You don’t need to perform perfectly. Give yourself one thing to practise.</p>
    <ol className="guide">{steps.map(([title, body], i) => <li key={title}><span className="mono">0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
    <div className="note"><Mic size={16}/><p>Microphone mode uses browser speech recognition, which may send audio to your browser’s provider. Podium itself never records audio. Typed rehearsal needs no microphone. Gemini is optional and receives transcript excerpts only when enabled.</p></div>
    <button type="button" className="btn btn-lime btn-block" onClick={onClose}>Back to the room<ArrowRight size={16}/></button>
  </Dialog>;
}

export function AiDialog({ configured, model, onClose }: { configured: boolean; model: string; onClose: () => void }) {
  return <Dialog title="An audience powered by Gemini" eyebrow="Optional" onClose={onClose}>
    <p className="dialog-lead serif">One AI director, a room full of personalities.</p>
    <p className="dialog-copy">Gemini uses your transcript to guide audience reactions, ask relevant questions and suggest one improvement after your talk. Reactions are a simulation, not a measurement of what real people would think.</p>
    <div className="note col">
      <strong>{configured ? 'Gemini is connected to this studio.' : 'Connect Gemini on your server'}</strong>
      {configured
        ? <p>{model} is ready. Enable it with the switch in Set the scene. Transcript excerpts are sent to Google; audio is not.</p>
        : <><p>Add your Google AI Studio key to a local <code>.env</code> file, then restart the app:</p><pre>GEMINI_API_KEY=your_key{'\n'}GEMINI_MODEL=gemini-3.8-flash</pre><p>The key stays on the server. Local practice works without it.</p></>}
    </div>
    <button type="button" className="btn btn-lime btn-block" onClick={onClose}>Got it<Check size={16}/></button>
  </Dialog>;
}

export function HistoryView({ history, user, onOpen, onDelete, onNew }: { history: Report[]; user: User; onOpen: (r: Report) => void; onDelete: (r: Report) => void; onNew: () => void }) {
  const totalSeconds = history.reduce((sum, r) => sum + r.metrics.seconds, 0);
  const totalWords = history.reduce((sum, r) => sum + r.metrics.words, 0);
  const paced = history.filter(r => r.metrics.pace !== null);
  const avgPace = paced.length ? Math.round(paced.reduce((sum, r) => sum + (r.metrics.pace ?? 0), 0) / paced.length) : null;
  return <main className="history">
    <div className="history-head">
      <div>
        <span className="mono">Small steps, real progress</span>
        <h1 className="display-md">{user.guest ? 'Your sessions' : `${user.name.split(' ')[0]}’s sessions`}<em className="serif">.</em></h1>
      </div>
      <button type="button" className="btn btn-lime" onClick={onNew}>New rehearsal<ArrowRight size={16}/></button>
    </div>
    {history.length > 0 && <div className="history-stats">
      <div><b>{history.length}</b><span>Rehearsals</span></div>
      <div><b>{formatTime(totalSeconds)}</b><span>On stage</span></div>
      <div><b>{totalWords.toLocaleString()}</b><span>Words spoken</span></div>
      <div><b>{avgPace ?? '—'}</b><span>Average WPM</span></div>
    </div>}
    {history.length === 0
      ? <div className="history-empty"><span className="empty-mark"><History size={26}/></span><h2>Your first chapter is waiting.</h2><p>Complete a rehearsal and your reflections will collect here.</p><button type="button" className="btn btn-lime" onClick={onNew}>Take the stage<ArrowRight size={16}/></button></div>
      : <ul className="history-list">{history.map((item, i) => <li key={item.id} className="history-item" style={{ '--i': i } as CSSProperties}>
        <span className="mono history-n">{String(history.length - i).padStart(2, '0')}</span>
        <button type="button" className="history-open" onClick={() => onOpen(item)}>
          <span className="history-when mono">{scenarios.find(s => s.id === item.config.scenario)?.label || 'Practice'} · {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span className="history-topic">{item.config.topic}</span>
          <span className="history-facts">{formatTime(item.metrics.seconds)} · {item.metrics.words} words · {item.metrics.pace ? `${item.metrics.pace} wpm · ` : ''}{item.metrics.fillers} fillers · {item.config.audience} listeners</span>
        </button>
        <span className={`history-src ${item.source === 'gemini' ? 'is-ai' : ''}`}>{item.source === 'gemini' ? 'Gemini' : 'Local'}</span>
        <button type="button" className="icon-btn" aria-label={`Delete session ${item.config.topic}`} title="Delete session" onClick={() => onDelete(item)}><Trash2 size={16}/></button>
      </li>)}</ul>}
    <p className="history-note">Your last 20 rehearsals are saved in this browser{user.guest ? '' : ' for this account'}. Export a reflection to keep a permanent copy.</p>
  </main>;
}
