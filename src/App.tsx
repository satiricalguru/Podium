import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, AudioLines, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Eye, History, Lightbulb, Maximize2, MessageCircle, Mic, MicOff, Pause, Play, Plus, RotateCcw, Settings2, Sparkles, Square, Trash2, Users, Volume2, X, Presentation, Zap, PanelLeftClose } from 'lucide-react';
const Room=lazy(()=>import('./Room'));
import { analyze, baseline, formatTime, localAudience, localFeedback, type InputMode, type Temperament } from './lib/analysis';
import type { Direction, PracticeConfig, Report } from './lib/types';
import { usePractice } from './hooks/usePractice';
import { loadHistory, saveHistory } from './lib/storage';

const scenarios=[{id:'keynote',label:'Keynote',icon:Presentation,topic:'The power of small, consistent steps',description:'Inspire a room with one big idea.'},{id:'pitch',label:'Product pitch',icon:Zap,topic:'An idea that changes how we work',description:'Make a compelling case for your idea.'},{id:'impromptu',label:'Impromptu',icon:MessageCircle,topic:'What makes a great leader?',description:'Think on your feet. Find your point.'}];
const initial:PracticeConfig={scenario:'keynote',topic:scenarios[0].topic,audience:48,temperament:'supportive',duration:300,mode:'voice'};
function IconButton({children,label,onClick,active=false,disabled=false}:{children:ReactNode;label:string;onClick:()=>void;active?:boolean;disabled?:boolean}){return <button className={`icon-button ${active?'is-active':''}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;}
function Dialog({children,title,onClose,wide=false}:{children:ReactNode;title:string;onClose:()=>void;wide?:boolean}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.focus();const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=before;previous?.focus();};},[]);
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={`dialog ${wide?'dialog-wide':''}`} ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const items=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, a[href]');if(!items?.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus();}}}}><div className="dialog-heading"><h2>{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={20}/></IconButton></div>{children}</div></div>;
}
export default function App(){
  const [config,setConfig]=useState(initial);
  const practice=usePractice(config.mode);
  const {status,seconds,transcript,interim,muted,level,micState,inputError,sessionId}=practice;
  const [view,setView]=useState<'studio'|'history'>('studio');
  const [focus,setFocus]=useState(false);
  const [resetView,setResetView]=useState(0);
  const [journal,setJournal]=useState<'notes'|'transcript'>('notes');
  const [notes,setNotes]=useState('Open with a story.\nOne idea, one example, one takeaway.\nPause. Let the room catch up.');
  const [draft,setDraft]=useState('');
  const [history,setHistory]=useState<Report[]>(loadHistory);
  const [report,setReport]=useState<Report|null>(null);
  const [guide,setGuide]=useState(false);
  const [aiHelp,setAiHelp]=useState(false);
  const [configured,setConfigured]=useState(false);
  const [aiModel,setAiModel]=useState('');
  const [aiEnabled,setAiEnabled]=useState(false);
  const [aiDirection,setAiDirection]=useState<Direction|null>(null);
  const [aiStatus,setAiStatus]=useState('Local audience');
  const [question,setQuestion]=useState<{text:string;source:string}|null>(null);
  const [questionBusy,setQuestionBusy]=useState(false);
  const [feedbackBusy,setFeedbackBusy]=useState(false);
  const [toast,setToast]=useState('');
  const [storageWarning,setStorageWarning]=useState(false);
  const generation=useRef(0);
  const controllers=useRef(new Set<AbortController>());
  const completedSession=useRef(-1);
  const aiEnabledRef=useRef(aiEnabled);aiEnabledRef.current=aiEnabled;
  const metrics=analyze(transcript,seconds,config.mode);
  const local=localAudience(metrics,config.temperament);
  const direction=aiEnabled && aiDirection ? aiDirection : local;
  const engagement=status==='ready'?baseline(config.temperament):direction.engagement;
  const locked=status==='running'||status==='paused';
  const current=useRef({config,metrics,transcript,status});current.current={config,metrics,transcript,status};
  const notify=useCallback((message:string)=>setToast(message),[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{
    const controller=new AbortController();
    const refresh=()=>void fetch('/api/health',{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{setConfigured(!!data.geminiConfigured);setAiModel(data.model||'');}).catch(()=>{if(!controller.signal.aborted)setConfigured(false);});
    refresh();const timer=setInterval(refresh,15000);
    return()=>{clearInterval(timer);controller.abort();};
  },[]);
  useEffect(()=>{if(!saveHistory(history)&&!storageWarning){setStorageWarning(true);notify('Browser storage is unavailable. Export your report to keep a copy.');}},[history,storageWarning,notify]);
  useEffect(()=>()=>{generation.current++;controllers.current.forEach(c=>c.abort());window.speechSynthesis?.cancel();},[]);
  useEffect(()=>{if(!focus)return;const listener=(e:KeyboardEvent)=>{if(e.key==='Escape')setFocus(false);};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[focus]);
  const callAi=useCallback(async(mode:'reaction'|'question'|'feedback',payload= current.current)=>{
    const requestGeneration=generation.current;
    const controller=new AbortController();controllers.current.add(controller);
    const timeout=setTimeout(()=>controller.abort(),23000);
    try{
      const result=await fetch('/api/audience',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,topic:payload.config.topic,temperament:payload.config.temperament,transcript:payload.transcript.slice(-12000),metrics:payload.metrics}),signal:controller.signal});
      const data=await result.json().catch(()=>({error:'Unable to parse server response.'}));
      if(!result.ok)throw new Error(data.error||'Gemini is unavailable.');
      if(requestGeneration!==generation.current||!aiEnabledRef.current)return null;
      if(typeof data.engagement!=='number'||!['engaged','curious','distracted'].includes(data.reaction)||!['cue','question','strength','improvement'].every(k=>typeof data[k]==='string'))throw new Error('The AI response was incomplete.');
      return data as Direction;
    }finally{clearTimeout(timeout);controllers.current.delete(controller);}
  },[]);
  const cancelRequests=()=>{generation.current++;controllers.current.forEach(c=>c.abort());controllers.current.clear();setQuestionBusy(false);setFeedbackBusy(false);};
  useEffect(()=>{
    if(!aiEnabled||status!=='running')return;
    let busy=false, disposed=false,lastText='';
    const tick=async()=>{
      const payload=current.current;
      if(busy||payload.status!=='running'||payload.metrics.words<5||payload.transcript===lastText)return;
      busy=true;lastText=payload.transcript;setAiStatus('Listening with Gemini');
      try{const result=await callAi('reaction',payload);if(result&&!disposed){setAiDirection(result);setAiStatus(result.model?`${result.model.replace('gemini-','Gemini ').replaceAll('-',' ')} connected`:'Gemini connected');}}
      catch{if(!disposed){setAiDirection(null);setAiStatus('Gemini unavailable · local reactions');}}
      finally{busy=false;}
    };
    const timer=setInterval(()=>void tick(),20000);
    return()=>{disposed=true;clearInterval(timer);};
  },[aiEnabled,status,sessionId,callAi]);
  useEffect(()=>{if(status==='running'&&seconds>=config.duration){if(config.mode==='typed'&&draft.trim()){practice.append(draft);setDraft('');}practice.end();}},[status,seconds,config.duration,config.mode,draft]);
  useEffect(()=>{
    if(status!=='completed'||completedSession.current===sessionId)return;
    completedSession.current=sessionId;
    cancelRequests();window.speechSynthesis?.cancel();setFocus(false);
    const finalMetrics=analyze(transcript,seconds,config.mode);
    const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : `podium-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const next:Report={id,date:new Date().toISOString(),config:{...config},metrics:finalMetrics,transcript,engagement,feedback:localFeedback(finalMetrics,config.topic),source:'local'};
    setReport(next);setHistory(prev=>[next,...prev].slice(0,20));
    if(aiEnabled&&configured&&transcript.trim()){
      setFeedbackBusy(true);
      void callAi('feedback',{config,metrics:finalMetrics,transcript,status}).then(result=>{
        if(!result)return;
        const updated:Report={...next,source:'gemini',feedback:{strength:result.strength,improvement:result.improvement,question:result.question}};
        setReport(prev=>prev?.id===next.id?updated:prev);setHistory(prev=>prev.map(item=>item.id===next.id?updated:item));
      }).catch(()=>notify('Gemini coaching was unavailable. Your report includes local observations.')).finally(()=>setFeedbackBusy(false));
    }
  },[status,sessionId]);
  function begin(){
    if(!config.topic.trim()){notify('Add a topic before you take the stage.');return;}
    cancelRequests();setReport(null);setAiDirection(null);setQuestion(null);setDraft('');setJournal(config.mode==='typed'?'transcript':'notes');setAiStatus(aiEnabled?'Gemini ready':'Local audience');practice.start();
  }
  function newPractice(){cancelRequests();practice.reset();setReport(null);setQuestion(null);setAiDirection(null);setDraft('');setView('studio');}
  function configure<K extends keyof PracticeConfig>(key:K,value:PracticeConfig[K]){if(locked)return;setConfig(prev=>({...prev,[key]:value}));}
  function addDraft(){if(!draft.trim())return;practice.append(draft);setDraft('');}
  async function askQuestion(){
    if(questionBusy)return;
    window.speechSynthesis?.cancel();setQuestion(null);
    if(!aiEnabled){setQuestion({text:localFeedback(metrics,config.topic).question,source:'Local audience question'});return;}
    setQuestionBusy(true);
    const questionGeneration=generation.current;
    try{const result=await callAi('question');if(result)setQuestion({text:result.question,source:'Gemini audience question'});}
    catch{if(questionGeneration===generation.current){setQuestion({text:localFeedback(metrics,config.topic).question,source:'Local audience question'});notify('Gemini was unavailable. A local audience question is ready.');}}
    finally{if(questionGeneration===generation.current)setQuestionBusy(false);}
  }
  function toggleAi(){if(!configured){setAiHelp(true);return;}cancelRequests();setAiEnabled(prev=>!prev);setAiDirection(null);setAiStatus(aiEnabled?'Local audience':'Gemini ready');}
  function exportReport(item:Report){const url=URL.createObjectURL(new Blob([JSON.stringify(item,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`podium-session-${item.date.slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
  const reactionLabel=metrics.words===0?'Listening':direction.reaction==='engaged'?'Engaged':direction.reaction==='curious'?'Curious':'Distracted';
  return <div className={`app-shell ${focus?'focus-mode':''}`}>
    <aside className="sidebar">
      <a className="brand" href="#studio" onClick={e=>{e.preventDefault();setView('studio');}}><span className="brand-symbol">p<span/></span>podium<span className="brand-dot">.</span></a>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Main navigation">
        <button className={`nav-item ${view==='studio'?'selected':''}`} onClick={()=>setView('studio')}><AudioLines size={19}/>Practice studio<span className="nav-dot"/></button>
        <button className={`nav-item ${view==='history'?'selected':''}`} onClick={()=>setView('history')} disabled={locked}><History size={19}/>Session history{history.length>0&&<span className="nav-count">{history.length}</span>}</button>
      </nav>
      <div className="sidebar-divider"/>
      <button className="nav-item" onClick={()=>setGuide(true)}><BookOpen size={19}/>Speaking guide<ChevronRight size={14} className="nav-end"/></button>
      <div className="sidebar-note"><div className="little-orbit"><AudioLines size={26}/></div><span>A space to grow.</span><p>One session. One small step.<br/>A stronger voice.</p><button onClick={()=>setGuide(true)}>Make the most of practice<ArrowUpRightIcon/></button></div>
      <div className="sidebar-bottom"><span className="avatar">Y</span><div><strong>Your personal studio</strong><span>Saved on this device</span></div><IconButton label="Open speaking guide" onClick={()=>setGuide(true)}><CircleHelp size={17}/></IconButton></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><strong>{view==='studio'?'Practice studio':'Session history'}</strong></div><div className="topbar-right"><span className={`connection ${aiEnabled?'ai-on':''}`}><span/>{aiEnabled?'Gemini audience':'Local audience'}</span><IconButton label="Open help" onClick={()=>setGuide(true)}><CircleHelp size={19}/></IconButton><span className="avatar small">Y</span></div></header>
      {view==='studio'?<main className="studio-main">
        <div className="page-heading"><div><div className="eyebrow">THE FLOOR IS YOURS</div><h1>Your practice studio<span>.</span></h1><p>A room to experiment. An audience to connect with.</p></div><button className="subtle-button" onClick={()=>setGuide(true)}><Lightbulb size={16}/>A little guidance<ArrowRight size={15}/></button></div>
        <div className="studio-grid">
          <div className="practice-column">
            <section className="stage-card" aria-label="Auditorium practice room">
              <div className="stage-heading"><div><span className="room-icon"><Presentation size={18}/></span><div><h2>The Grand Auditorium</h2><span>Warm lights. Fresh perspective.</span></div></div><span className="view-label"><Eye size={13}/>PODIUM VIEW</span></div>
              <div className="room-scene"><Suspense fallback={<div className="room-fallback">Preparing your auditorium…</div>}><Room count={config.audience} engagement={engagement} reaction={direction.reaction} question={!!question} reset={resetView}/></Suspense>
                <div className="room-top"><span className={`room-status ${status==='running'?'recording':''}`}><span/>{status==='running'?'IN SESSION':status==='paused'?'PAUSED':'READY WHEN YOU ARE'}</span><div className="room-tools"><IconButton label="Reset room view" onClick={()=>setResetView(v=>v+1)}><RotateCcw size={16}/></IconButton><IconButton label={focus?'Exit focus mode':'Enter focus mode'} onClick={()=>setFocus(v=>!v)}><Maximize2 size={16}/></IconButton></div></div>
                <div className="room-bottom"><span><Users size={14}/>{config.audience} people in the room</span><span className="audience-state"><i/>{status==='ready'?'Settling in':reactionLabel}</span></div>
                {status==='ready'&&<div className="ready-prompt"><span className="prompt-line"/><span>Your next great talk starts here.</span><span className="prompt-line"/></div>}
                {question&&<div className="audience-question"><div><span><MessageCircle size={14}/>{question.source}</span><button aria-label="Dismiss audience question" onClick={()=>{setQuestion(null);window.speechSynthesis?.cancel();}}><X size={16}/></button></div><p>{question.text}</p><button className="read-question" onClick={()=>{if(!window.speechSynthesis){notify('Spoken questions are unavailable in this browser.');return;}window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(question.text);speech.rate=.95;window.speechSynthesis.speak(speech);}}><Volume2 size={14}/>Read question aloud</button></div>}
              </div>
              <div className="session-controls"><div className="mic-controls"><IconButton label={muted?'Unmute microphone':'Mute microphone'} onClick={()=>practice.setMuted(v=>!v)} disabled={!locked||config.mode==='typed'} active={muted}>{muted?<MicOff size={20}/>:<Mic size={20}/>}</IconButton><div className="waveform" aria-label={`Microphone input level ${Math.round(level*100)} percent`}>{Array.from({length:15},(_,i)=><i key={i} style={{height:locked&&config.mode==='voice'?`${5+level*(10+Math.sin(i*1.6)*7)*2}px`:`${[5,9,15,8,21,12,7,18,11,23,9,16,6,12,5][i]}px`}}/>)}</div><div className="time-readout"><strong>{formatTime(seconds)}</strong><span>/ {formatTime(config.duration)}</span></div></div>
                <div className="main-controls">{!locked?<button className="primary-button" onClick={begin}><Play size={16} fill="currentColor"/>Start practice<ArrowRight size={16}/></button>:<><IconButton label={status==='paused'?'Resume practice':'Pause practice'} onClick={status==='paused'?practice.resume:practice.pause}>{status==='paused'?<Play size={19}/>:<Pause size={19}/>}</IconButton><button className="end-button" onClick={()=>{if(config.mode==='typed'&&draft.trim()){addDraft();}practice.end();}}><Square size={12} fill="currentColor"/>End session</button></>}</div>
              </div>
              <div className="stage-caption"><span className="caption-dot"/>{config.mode==='typed'?'Typed rehearsal · no microphone needed':locked?micState:'Microphone connects when you start'}<span>{focus?'Esc to leave focus mode':'A little courage goes a long way.'}</span></div>
            </section>
            <div className="metrics-row">
              <Metric icon={<Users size={17}/>} label="Audience engagement" value={`${engagement}%`} suffix="simulated"><div className="engagement-track"><i style={{width:`${engagement}%`}}/></div></Metric>
              <Metric icon={<AudioLines size={17}/>} label="Speaking pace" value={metrics.pace!==null?String(metrics.pace):'—'} suffix={config.mode==='typed'?'typed rehearsal':'words / min'}><span className="metric-note">{config.mode==='typed'?'Text feedback only':metrics.pace===null?'Waiting for enough speech':metrics.pace>=105&&metrics.pace<=175?'A comfortable rhythm':metrics.pace>175?'Try a little more space':'Keep your ideas connected'}</span></Metric>
              <Metric icon={<MessageCircle size={17}/>} label="Filler phrases" value={transcript?String(metrics.fillers):'—'} suffix="detected"><span className="metric-note">{transcript?`${metrics.words} words in your transcript`:'A pause is a powerful thing'}</span></Metric>
            </div>
            <section className="journal-card"><div className="journal-heading"><div role="tablist" aria-label="Practice companion"><button role="tab" aria-selected={journal==='notes'} className={journal==='notes'?'active':''} onClick={()=>setJournal('notes')}><BookOpen size={16}/>Speaker notes</button><button role="tab" aria-selected={journal==='transcript'} className={journal==='transcript'?'active':''} onClick={()=>setJournal('transcript')}><AudioLines size={16}/>Live transcript{transcript&&<span>{metrics.words}</span>}</button></div><span className="journal-hint">{journal==='notes'?'Just for your eyes':'Your words, as they arrive'}</span></div>
              {journal==='notes'?<textarea className="notes-input" aria-label="Speaker notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="A few notes to keep you grounded…"/>:<div className="transcript-panel"><p className={transcript?'':'empty-transcript'}>{transcript||'Your transcript will appear here during practice.'}<span className="interim"> {interim}</span></p>{config.mode==='typed'&&<form onSubmit={e=>{e.preventDefault();addDraft();}}><textarea aria-label="Rehearsal text" placeholder="Write a part of your talk, then add it to the rehearsal…" value={draft} onChange={e=>setDraft(e.target.value)} disabled={status!=='running'} maxLength={12000}/><button className="subtle-button" disabled={status!=='running'||!draft.trim()} type="submit">Add to rehearsal<ArrowRight size={15}/></button></form>}</div>}
              {inputError&&<div className="input-warning" role="status"><CircleHelp size={16}/><div>{inputError}<button className="fallback-button" onClick={()=>{setConfig(prev=>({...prev,mode:'typed'}));setJournal('transcript');}}>Switch to typed rehearsal<ArrowRight size={13}/></button></div></div>}
            </section>
          </div>
          <aside className="setup-card" aria-label="Session setup">
            <div className="setup-heading"><span className="section-mark"><Settings2 size={18}/></span><h2>Set the scene</h2><span>01</span></div>
            <fieldset disabled={locked}><legend className="field-label">What are we practising?</legend><div className="scenario-options">{scenarios.map(s=><button key={s.id} className={`scenario-button ${config.scenario===s.id?'chosen':''}`} aria-pressed={config.scenario===s.id} onClick={()=>{setConfig(prev=>({...prev,scenario:s.id,topic:s.topic}));}}><s.icon size={16}/>{s.label}{config.scenario===s.id&&<Check size={14}/>}</button>)}</div><label className="field-label topic-label" htmlFor="topic">Your topic</label><textarea id="topic" className="topic-input" value={config.topic} onChange={e=>configure('topic',e.target.value)} maxLength={200} rows={2}/>
              <div className="field-top"><span className="field-label">Audience size</span><span className="tiny-value">{config.audience} people</span></div><div className="segments audience-segments">{[24,48,72].map(n=><button key={n} aria-label={`${n} audience members`} aria-pressed={config.audience===n} onClick={()=>configure('audience',n)} className={config.audience===n?'chosen':''}><Users size={15}/>{n}</button>)}</div>
              <div className="field-top"><span className="field-label">Audience energy</span><span className="small-help" title="Changes the audience's initial engagement and reactions"><CircleHelp size={13}/></span></div><div className="energy-options">{(['supportive','neutral','challenging'] as Temperament[]).map((m,i)=><button key={m} className={config.temperament===m?'chosen':''} aria-pressed={config.temperament===m} onClick={()=>configure('temperament',m)}><span>{['☺','◉','↗'][i]}</span>{m[0].toUpperCase()+m.slice(1)}</button>)}</div><p className="field-description">{config.temperament==='supportive'?'Friendly faces. A little encouragement.':config.temperament==='neutral'?'An attentive room, waiting to be convinced.':'A thoughtful crowd with tougher questions.'}</p>
              <div className="field-top"><span className="field-label">Session length</span><Clock3 size={14} className="muted-icon"/></div><div className="segments">{[180,300,600].map(n=><button key={n} aria-pressed={config.duration===n} onClick={()=>configure('duration',n)} className={config.duration===n?'chosen':''}>{n/60} min</button>)}</div>
              <span className="field-label input-mode-label">How will you practise?</span><div className="segments input-segments">{(['voice','typed'] as InputMode[]).map(mode=><button key={mode} className={config.mode===mode?'chosen':''} aria-pressed={config.mode===mode} onClick={()=>configure('mode',mode)}>{mode==='voice'?<Mic size={14}/>:<BookOpen size={14}/>} {mode==='voice'?'Microphone':'Typed rehearsal'}</button>)}</div>
            </fieldset>
            <div className={`gemini-section ${aiEnabled?'enabled':''}`}><div><span className="gemini-spark"><Sparkles size={19}/></span><div><strong>Bring your audience to life</strong><span>{aiEnabled?aiStatus:configured?`${aiModel.replace('gemini-','Gemini ').replaceAll('-',' ')} ready`:'Let Gemini listen and respond'}</span></div><button className={`toggle ${aiEnabled?'on':''}`} role="switch" aria-checked={aiEnabled} aria-label="Enable Gemini audience" onClick={toggleAi}><span/></button></div><p>{aiEnabled?'Transcript excerpts are sent to Google for reactions and coaching.':configured?'Optional AI reactions, questions and coaching. Enabling sends transcript excerpts to Google.':'Local reactions are ready. Connect Gemini for content-aware questions and coaching.'}</p><button className="text-link" onClick={()=>setAiHelp(true)}>About Gemini<Sparkles size={12}/></button></div>
            <div className="setup-footer"><span className="quiet-check"><Check size={12}/></span>{locked?'Scene settings are locked during practice.':'Your room. Your pace. No pressure.'}</div>
          </aside>
        </div>
        <div className="coach-strip"><span className="coach-icon"><Lightbulb size={18}/></span><div><strong>{locked?'A quiet coaching cue':'Before you take the stage'}</strong><p>{locked?direction.cue:'Take one slow breath. You don’t need a perfect opening — just your first sentence.'}</p></div><button className="subtle-button" onClick={()=>void askQuestion()} disabled={!locked||questionBusy}><MessageCircle size={15}/>{questionBusy?'Thinking…':'Ask me a question'}<ArrowRight size={15}/></button></div>
        <footer className="workspace-footer"><span>Made for the moments before the big moment.</span><span>{config.mode==='voice'?'Browser transcription may process audio via its provider.':'Typed rehearsal stays on this device unless Gemini is enabled.'}</span></footer>
      </main>:<main className="history-main"><div className="page-heading"><div><div className="eyebrow">SMALL STEPS, REAL PROGRESS</div><h1>Your session history<span>.</span></h1><p>Every time you take the stage, you learn something.</p></div><button className="primary-button" onClick={newPractice}><Plus size={16}/>New practice</button></div>{history.length===0?<div className="history-empty"><span className="large-history-icon"><History size={32}/></span><h2>Your first chapter is waiting.</h2><p>Complete a practice session and find your reflections here.</p><button className="primary-button" onClick={newPractice}>Take the stage<ArrowRight size={16}/></button></div>:<div className="history-list">{history.map(item=><article className="history-item" key={item.id}><span className="history-item-icon"><Presentation size={21}/></span><div><span className="eyebrow">{scenarios.find(s=>s.id===item.config.scenario)?.label||'Practice'} · {new Date(item.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span><h2>{item.config.topic}</h2><p>{formatTime(item.metrics.seconds)} · {item.metrics.words} words · {item.config.audience} listeners · {item.config.mode==='typed'?'Typed rehearsal':'Voice practice'}</p></div><button className="subtle-button" onClick={()=>setReport(item)}>View reflection<ArrowRight size={15}/></button><IconButton label={`Delete session ${item.config.topic}`} onClick={()=>{setHistory(prev=>prev.filter(r=>r.id!==item.id));notify('Session removed from this device.');}}><Trash2 size={17}/></IconButton></article>)}</div>}<p className="history-storage-note">Your last 20 sessions are saved in this browser. Export a reflection to keep a permanent copy.</p></main>}
    </div>
    {focus&&<div className="focus-notes"><BookOpen size={17}/><span>{notes.split('\n')[0]||'The floor is yours.'}</span><button onClick={()=>setFocus(false)}><PanelLeftClose size={15}/>Leave focus</button></div>}
    {report&&<Dialog title="Your session reflection" onClose={()=>setReport(null)} wide><div className="report-intro"><span className="report-check"><Check size={28}/></span><div className="eyebrow">YOU TOOK THE STAGE</div><h3>{report.config.topic}</h3><p>{report.config.audience} listeners · {report.config.temperament} audience · {report.config.mode==='typed'?'Typed rehearsal':'Voice practice'}</p></div><div className="report-metrics"><div><strong>{formatTime(report.metrics.seconds)}</strong><span>Practice time</span></div><div><strong>{report.metrics.words}</strong><span>Transcript words</span></div><div><strong>{report.metrics.pace??'—'}</strong><span>{report.config.mode==='typed'?'No voice measurement':'Words / min'}</span></div><div><strong>{report.metrics.fillers}</strong><span>Filler phrases</span></div></div><div className="report-source"><Sparkles size={13}/>{feedbackBusy?'Gemini is preparing your reflection…':report.source==='gemini'?'Content feedback by Gemini':'Local observations · no AI assessment'}{report.config.mode==='voice'&&report.metrics.seconds<30&&<span>Short sample · preliminary</span>}</div><div className="feedback-grid"><div><span className="feedback-label"><Check size={15}/>Something to build on</span><p>{report.feedback.strength}</p></div><div><span className="feedback-label"><ArrowRight size={15}/>One thing for next time</span><p>{report.feedback.improvement}</p></div></div><div className="report-question"><MessageCircle size={17}/><div><strong>A question to think about</strong><p>{report.feedback.question}</p></div></div><details className="report-transcript"><summary>Your transcript<ChevronDown size={16}/></summary><p>{report.transcript||'No transcript was captured in this session.'}</p></details><div className="report-actions"><button className="subtle-button" onClick={()=>exportReport(report)}><ArrowDownToLine size={16}/>Export reflection</button><button className="primary-button" onClick={newPractice}>Practise again<ArrowRight size={16}/></button></div></Dialog>}
    {guide&&<Dialog title="A little guidance" onClose={()=>setGuide(false)}><p className="dialog-lead">You don’t need to perform perfectly. Give yourself one thing to practise.</p><div className="guide-step"><span>01</span><div><h3>Make the room your own</h3><p>Choose a topic, audience and length. A supportive room is a good place to start.</p></div></div><div className="guide-step"><span>02</span><div><h3>Speak to one person</h3><p>Start with your main idea. Add a story or example. Let a pause do some of the work.</p></div></div><div className="guide-step"><span>03</span><div><h3>Find one small improvement</h3><p>Review your reflection, choose one change, and try the same talk again.</p></div></div><div className="privacy-note"><Mic size={17}/><p>Microphone mode uses browser speech recognition, which may send audio to your browser provider. Podium doesn’t record audio. Typed rehearsal needs no microphone. Gemini is optional and receives transcript excerpts only when enabled.</p></div><button className="primary-button dialog-primary" onClick={()=>setGuide(false)}>Back to the room<ArrowRight size={16}/></button></Dialog>}
    {aiHelp&&<Dialog title="An audience powered by Gemini" onClose={()=>setAiHelp(false)}><span className="ai-dialog-icon"><Sparkles size={32}/></span><p className="dialog-lead">One AI director, a room full of personalities.</p><p className="dialog-copy">Gemini uses your transcript to guide audience reactions, ask relevant questions and suggest one improvement after your talk. Reactions are a simulation, not a measurement of what real people would think.</p><div className="ai-setup-box"><strong>{configured?'Gemini is connected to this studio.':'Connect Gemini on your server'}</strong>{configured?<p>{aiModel} is ready. Enable it with the switch in your scene settings. Your transcript excerpts will be sent to Google; audio is not sent to Gemini in this version.</p>:<><p>Add your Google AI Studio key to a local <code>.env</code> file, then restart the app:</p><pre>GEMINI_API_KEY=your_key<br/>GEMINI_MODEL=gemini-3.8-flash</pre><p>The key stays on the server. Local practice works without it.</p></>}</div><button className="primary-button dialog-primary" onClick={()=>setAiHelp(false)}>Got it<Check size={16}/></button></Dialog>}
    {toast&&<div className="toast" role="status"><CircleHelp size={17}/>{toast}<button onClick={()=>setToast('')} aria-label="Dismiss notification"><X size={16}/></button></div>}
  </div>;
}
function ArrowUpRightIcon(){return <ArrowRight size={14} className="diagonal-arrow"/>;}
function Metric({icon,label,value,suffix,children}:{icon:ReactNode;label:string;value:string;suffix:string;children:ReactNode}){return <div className="metric-card"><div className="metric-label">{icon}<span>{label}</span></div><div className="metric-value"><strong>{value}</strong><span>{suffix}</span></div>{children}</div>;}
