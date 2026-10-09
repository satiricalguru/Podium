import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, AudioLines, BookOpen, CircleAlert, Maximize2, MessageCircle, Mic, MicOff, Minimize2, Pause, Play, RotateCcw, Square, Volume2, X } from 'lucide-react';
import { analyze, baseline, formatTime, localAudience, localFeedback } from '../lib/analysis';
import type { Direction, PracticeConfig, Report } from '../lib/types';
import { usePractice } from '../hooks/usePractice';
import { loadHistory, saveHistory } from '../lib/storage';
import { useAuth, type User } from '../auth/AuthContext';
import { navigate } from '../router';
import { IconButton } from '../ui/Dialog';
import { AiDialog, DirectorPanel, GuideDialog, HistoryView, Metric, ReportDialog, SetupPanel, StudioNav, prettyModel, scenarios } from './parts';

const StageRoom = lazy(() => import('./StageRoom'));
const initial: PracticeConfig = { scenario: 'keynote', topic: scenarios[0].topic, audience: 48, temperament: 'supportive', duration: 300, mode: 'voice' };

export default function Studio({ view, user }: { view: 'studio' | 'history'; user: User }) {
  const { signOut } = useAuth();
  const [config, setConfig] = useState(initial);
  const practice = usePractice(config.mode);
  const { status, seconds, transcript, interim, muted, level, micState, inputError, sessionId } = practice;
  const [focus, setFocus] = useState(false);
  const [resetView, setResetView] = useState(0);
  const [journal, setJournal] = useState<'notes' | 'transcript'>('notes');
  const [notes, setNotes] = useState('Open with a story.\nOne idea, one example, one takeaway.\nPause. Let the room catch up.');
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<Report[]>(() => loadHistory(user.id));
  const [report, setReport] = useState<Report | null>(null);
  const [guide, setGuide] = useState(false);
  const [aiHelp, setAiHelp] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [aiModel, setAiModel] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDirection, setAiDirection] = useState<Direction | null>(null);
  const [aiStatus, setAiStatus] = useState('Local audience');
  const [question, setQuestion] = useState<{ text: string; source: string } | null>(null);
  const [questionBusy, setQuestionBusy] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const generation = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const completedSession = useRef(-1);
  const aiEnabledRef = useRef(aiEnabled); aiEnabledRef.current = aiEnabled;

  const metrics = analyze(transcript, seconds, config.mode);
  const local = localAudience(metrics, config.temperament);
  const direction = aiEnabled && aiDirection ? aiDirection : local;
  const engagement = status === 'ready' ? baseline(config.temperament) : direction.engagement;
  const locked = status === 'running' || status === 'paused';
  const current = useRef({ config, metrics, transcript, status }); current.current = { config, metrics, transcript, status };
  const notify = useCallback((message: string) => setToast(message), []);

  useEffect(() => { document.title = view === 'studio' ? (locked ? `● ${formatTime(seconds)} — Podium` : 'Studio — Podium') : 'History — Podium'; });
  useEffect(() => () => { document.title = 'Podium — Rehearse in a room that reacts'; }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => void fetch('/api/health', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { setConfigured(!!data.geminiConfigured); setAiModel(data.model || ''); }).catch(() => { if (!controller.signal.aborted) setConfigured(false); });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { clearInterval(timer); controller.abort(); };
  }, []);
  useEffect(() => { if (!saveHistory(user.id, history) && !storageWarning) { setStorageWarning(true); notify('Browser storage is unavailable. Export your report to keep a copy.'); } }, [history, storageWarning, notify, user.id]);
  useEffect(() => () => { generation.current++; controllers.current.forEach(c => c.abort()); window.speechSynthesis?.cancel(); }, []);
  useEffect(() => {
    if (!focus) return;
    const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocus(false); };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [focus]);
  // Leaving the studio mid-session (e.g. browser back) would silently orphan the mic — warn first.
  useEffect(() => {
    if (!locked) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [locked]);

  const callAi = useCallback(async (mode: 'reaction' | 'question' | 'feedback', payload = current.current) => {
    const requestGeneration = generation.current;
    const controller = new AbortController(); controllers.current.add(controller);
    const timeout = setTimeout(() => controller.abort(), 23000);
    try {
      const result = await fetch('/api/audience', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, topic: payload.config.topic, temperament: payload.config.temperament, transcript: payload.transcript.slice(-12000), metrics: payload.metrics }), signal: controller.signal });
      const data = await result.json().catch(() => ({ error: 'Unable to parse server response.' }));
      if (!result.ok) throw new Error(data.error || 'Gemini is unavailable.');
      if (requestGeneration !== generation.current || !aiEnabledRef.current) return null;
      if (typeof data.engagement !== 'number' || !['engaged', 'curious', 'distracted'].includes(data.reaction) || !['cue', 'question', 'strength', 'improvement'].every(k => typeof data[k] === 'string')) throw new Error('The AI response was incomplete.');
      return data as Direction;
    } finally { clearTimeout(timeout); controllers.current.delete(controller); }
  }, []);
  const cancelRequests = () => { generation.current++; controllers.current.forEach(c => c.abort()); controllers.current.clear(); setQuestionBusy(false); setFeedbackBusy(false); };

  useEffect(() => {
    if (!aiEnabled || status !== 'running') return;
    let busy = false, disposed = false, lastText = '';
    const tick = async () => {
      const payload = current.current;
      if (busy || payload.status !== 'running' || payload.metrics.words < 5 || payload.transcript === lastText) return;
      busy = true; lastText = payload.transcript; setAiStatus('Listening with Gemini');
      try { const result = await callAi('reaction', payload); if (result && !disposed) { setAiDirection(result); setAiStatus(result.model ? `${prettyModel(result.model)} connected` : 'Gemini connected'); } }
      catch { if (!disposed) { setAiDirection(null); setAiStatus('Gemini unavailable · local reactions'); } }
      finally { busy = false; }
    };
    const timer = setInterval(() => void tick(), 20000);
    return () => { disposed = true; clearInterval(timer); };
  }, [aiEnabled, status, sessionId, callAi]);

  useEffect(() => {
    if (status === 'running' && seconds >= config.duration) {
      if (config.mode === 'typed' && draft.trim()) { practice.append(draft); setDraft(''); }
      practice.end();
    }
  }, [status, seconds, config.duration, config.mode, draft]);

  useEffect(() => {
    if (status !== 'completed' || completedSession.current === sessionId) return;
    completedSession.current = sessionId;
    cancelRequests(); window.speechSynthesis?.cancel(); setFocus(false);
    const finalMetrics = analyze(transcript, seconds, config.mode);
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `podium-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const next: Report = { id, date: new Date().toISOString(), config: { ...config }, metrics: finalMetrics, transcript, engagement, feedback: localFeedback(finalMetrics, config.topic), source: 'local' };
    setReport(next); setHistory(prev => [next, ...prev].slice(0, 20));
    if (aiEnabled && configured && transcript.trim()) {
      setFeedbackBusy(true);
      void callAi('feedback', { config, metrics: finalMetrics, transcript, status }).then(result => {
        if (!result) return;
        const updated: Report = { ...next, source: 'gemini', feedback: { strength: result.strength, improvement: result.improvement, question: result.question } };
        setReport(prev => prev?.id === next.id ? updated : prev); setHistory(prev => prev.map(item => item.id === next.id ? updated : item));
      }).catch(() => notify('Gemini coaching was unavailable. Your report includes local observations.')).finally(() => setFeedbackBusy(false));
    }
  }, [status, sessionId]);

  function begin() {
    if (!config.topic.trim()) { notify('Add a topic before you take the stage.'); return; }
    cancelRequests(); setReport(null); setAiDirection(null); setQuestion(null); setDraft('');
    setJournal(config.mode === 'typed' ? 'transcript' : 'notes');
    setAiStatus(aiEnabled ? 'Gemini ready' : 'Local audience');
    practice.start();
  }
  function finish() { if (config.mode === 'typed' && draft.trim()) addDraft(); practice.end(); }
  function newPractice() { cancelRequests(); practice.reset(); setReport(null); setQuestion(null); setAiDirection(null); setDraft(''); navigate('/studio'); }
  function configure<K extends keyof PracticeConfig>(key: K, value: PracticeConfig[K]) { if (locked) return; setConfig(prev => ({ ...prev, [key]: value })); }
  function addDraft() { if (!draft.trim()) return; practice.append(draft); setDraft(''); }
  async function askQuestion() {
    if (questionBusy) return;
    window.speechSynthesis?.cancel(); setQuestion(null);
    if (!aiEnabled) { setQuestion({ text: localFeedback(metrics, config.topic).question, source: 'Audience question' }); return; }
    setQuestionBusy(true);
    const questionGeneration = generation.current;
    try { const result = await callAi('question'); if (result) setQuestion({ text: result.question, source: 'Gemini audience question' }); }
    catch { if (questionGeneration === generation.current) { setQuestion({ text: localFeedback(metrics, config.topic).question, source: 'Audience question' }); notify('Gemini was unavailable. A local audience question is ready.'); } }
    finally { if (questionGeneration === generation.current) setQuestionBusy(false); }
  }
  function toggleAi() { if (!configured) { setAiHelp(true); return; } cancelRequests(); setAiEnabled(prev => !prev); setAiDirection(null); setAiStatus(aiEnabled ? 'Local audience' : 'Gemini ready'); }
  function exportReport(item: Report) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `podium-session-${item.date.slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  function readAloud(text: string) {
    if (!window.speechSynthesis) { notify('Spoken questions are unavailable in this browser.'); return; }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text); speech.rate = .95; window.speechSynthesis.speak(speech);
  }
  async function leave() {
    if (locked && !window.confirm('End this rehearsal and sign out?')) return;
    cancelRequests(); practice.reset();
    await signOut();
    navigate('/', { replace: true });
  }

  const reactionLabel = metrics.words === 0 ? 'Listening' : direction.reaction === 'engaged' ? 'Engaged' : direction.reaction === 'curious' ? 'Curious' : 'Distracted';
  const paceNote = config.mode === 'typed' ? 'Typed rehearsal · text only' : metrics.pace === null ? 'Waiting for enough speech' : metrics.pace >= 105 && metrics.pace <= 175 ? 'A comfortable rhythm' : metrics.pace > 175 ? 'Try a little more space' : 'Keep your ideas connected';
  const remaining = Math.max(0, config.duration - seconds);

  return <div className={`studio ${focus ? 'is-focus' : ''} ${locked ? 'is-live' : ''} ${view === 'history' ? 'is-history' : ''}`}>
    <StudioNav view={view} user={user} locked={locked} aiEnabled={aiEnabled} onGuide={() => setGuide(true)} onSignOut={() => void leave()}/>

    {view === 'studio' ? <main className="studio-main">
      <section className="stage" aria-label="Auditorium practice room">
        <div className="stage-canvas">
          <Suspense fallback={<div className="room-fallback"><span className="loader"/>Setting up the auditorium…</div>}>
            <StageRoom count={config.audience} engagement={engagement} reaction={direction.reaction} question={!!question} reset={resetView} live={locked}/>
          </Suspense>
        </div>
        <div className="stage-shade" aria-hidden="true"/>

        <div className="stage-top">
          <span className={`status ${status === 'running' ? 'is-rec' : status === 'paused' ? 'is-paused' : ''}`}><i/>{status === 'running' ? 'Live' : status === 'paused' ? 'Paused' : 'Ready when you are'}</span>
          <span className="stage-room mono">{config.audience} in the room · {status === 'ready' ? 'settling in' : reactionLabel.toLowerCase()}</span>
          <div className="stage-tools">
            <IconButton label="Reset room view" onClick={() => setResetView(v => v + 1)}><RotateCcw size={16}/></IconButton>
            <IconButton label={focus ? 'Exit focus mode' : 'Enter focus mode'} onClick={() => setFocus(v => !v)} active={focus}>{focus ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</IconButton>
          </div>
        </div>

        {status === 'ready' && <div className="stage-hello" aria-hidden="true"><span className="mono">The Grand Auditorium</span><p className="serif">The floor is yours.</p></div>}

        {question && <div className="question" role="status">
          <div className="question-head"><span className="mono"><MessageCircle size={13}/>{question.source}</span><button type="button" className="icon-btn sm" aria-label="Dismiss audience question" onClick={() => { setQuestion(null); window.speechSynthesis?.cancel(); }}><X size={15}/></button></div>
          <p>{question.text}</p>
          <button type="button" className="link" onClick={() => readAloud(question.text)}><Volume2 size={14}/>Read it aloud</button>
        </div>}

        {locked && !question && <p className="subtitle" aria-live="polite">{direction.cue}</p>}
        {focus && <p className="focus-note"><BookOpen size={15}/>{notes.split('\n')[0] || 'The floor is yours.'}<span className="mono">Esc to leave focus</span></p>}

        <div className="dock" role="group" aria-label="Session controls">
          <IconButton label={muted ? 'Unmute microphone' : 'Mute microphone'} onClick={() => practice.setMuted(v => !v)} disabled={!locked || config.mode === 'typed'} active={muted}>{muted ? <MicOff size={18}/> : <Mic size={18}/>}</IconButton>
          <div className="wave" role="meter" aria-label="Microphone input level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
            {Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--h': locked && config.mode === 'voice' ? Math.min(1, .12 + level * (1.1 + Math.sin(i * 1.7) * .55)) : .12 + ((i * 37) % 11) / 40 } as CSSProperties}/>)}
          </div>
          <div className="clock"><b>{formatTime(seconds)}</b><span>{locked ? `−${formatTime(remaining)}` : `/ ${formatTime(config.duration)}`}</span></div>
          <div className="dock-progress" aria-hidden="true"><i style={{ transform: `scaleX(${Math.min(1, seconds / config.duration)})` }}/></div>
          {!locked
            ? <button type="button" className="btn btn-lime dock-start" onClick={begin}><Play size={15} fill="currentColor"/>Start rehearsal</button>
            : <>
              <IconButton label={status === 'paused' ? 'Resume practice' : 'Pause practice'} onClick={status === 'paused' ? practice.resume : practice.pause}>{status === 'paused' ? <Play size={18}/> : <Pause size={18}/>}</IconButton>
              <button type="button" className="btn btn-end" onClick={finish}><Square size={11} fill="currentColor"/>End</button>
            </>}
        </div>
        <p className="stage-caption mono">{config.mode === 'typed' ? 'Typed rehearsal · no microphone needed' : locked ? micState : 'Microphone connects when you start'}</p>
      </section>

      <aside className="rail rail-left" aria-label="Live feedback">
        <div className="panel metrics">
          <Metric label="Engagement" value={`${engagement}%`} note="Simulated audience"><div className="bar"><i style={{ width: `${engagement}%` }}/></div></Metric>
          <Metric label="Pace" value={metrics.pace !== null ? String(metrics.pace) : '—'} unit={config.mode === 'typed' ? '' : 'wpm'} note={paceNote}/>
          <Metric label="Fillers" value={transcript ? String(metrics.fillers) : '—'} note={transcript ? `${metrics.words} words so far` : 'A pause is a powerful thing'}/>
        </div>
        <section className="panel journal">
          <div className="tabs" role="tablist" aria-label="Practice companion">
            <button type="button" role="tab" id="tab-notes" aria-controls="panel-journal" aria-selected={journal === 'notes'} onClick={() => setJournal('notes')}><BookOpen size={14}/>Notes</button>
            <button type="button" role="tab" id="tab-transcript" aria-controls="panel-journal" aria-selected={journal === 'transcript'} onClick={() => setJournal('transcript')}><AudioLines size={14}/>Transcript{transcript && <span className="count">{metrics.words}</span>}</button>
          </div>
          <div id="panel-journal" role="tabpanel" aria-labelledby={journal === 'notes' ? 'tab-notes' : 'tab-transcript'} className="journal-body">
            {journal === 'notes'
              ? <textarea className="notes" aria-label="Speaker notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="A few notes to keep you grounded…"/>
              : <div className="transcript">
                <p className={transcript || interim ? '' : 'empty'}>{transcript || (!interim && 'Your words will appear here as you speak.')}{interim && <span className="interim"> {interim}</span>}</p>
                {config.mode === 'typed' && <form onSubmit={e => { e.preventDefault(); addDraft(); }}>
                  <textarea className="input" aria-label="Rehearsal text" placeholder={status === 'running' ? 'Write a part of your talk, then add it…' : 'Start the rehearsal to add text'} value={draft} onChange={e => setDraft(e.target.value)} disabled={status !== 'running'} maxLength={12000} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addDraft(); } }}/>
                  <button type="submit" className="btn btn-ghost btn-sm" disabled={status !== 'running' || !draft.trim()}>Add to rehearsal<ArrowRight size={14}/></button>
                </form>}
              </div>}
          </div>
          {inputError && <div className="warning" role="status"><CircleAlert size={16}/><div>{inputError}{config.mode === 'voice' && <button type="button" className="link" onClick={() => { setConfig(prev => ({ ...prev, mode: 'typed' })); setJournal('transcript'); }}>Switch to typed rehearsal<ArrowRight size={13}/></button>}</div></div>}
        </section>
      </aside>

      <aside className="rail rail-right" aria-label={locked ? 'Session director' : 'Session setup'}>
        {locked
          ? <DirectorPanel config={config} cue={direction.cue} aiStatus={aiStatus} aiEnabled={aiEnabled} questionBusy={questionBusy} onAsk={() => void askQuestion()}/>
          : <SetupPanel config={config} setConfig={setConfig} configure={configure} aiEnabled={aiEnabled} aiConfigured={configured} aiModel={aiModel} aiStatus={aiStatus} onToggleAi={toggleAi} onAiHelp={() => setAiHelp(true)}/>}
      </aside>
    </main>
      : <HistoryView history={history} user={user} onOpen={setReport} onNew={newPractice} onDelete={item => { setHistory(prev => prev.filter(r => r.id !== item.id)); notify('Session removed from this device.'); }}/>}

    {report && <ReportDialog report={report} feedbackBusy={feedbackBusy} onClose={() => setReport(null)} onExport={() => exportReport(report)} onAgain={newPractice}/>}
    {guide && <GuideDialog onClose={() => setGuide(false)}/>}
    {aiHelp && <AiDialog configured={configured} model={aiModel} onClose={() => setAiHelp(false)}/>}
    {toast && <div className="toast" role="status"><CircleAlert size={16}/><span>{toast}</span><button type="button" onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
  </div>;
}
