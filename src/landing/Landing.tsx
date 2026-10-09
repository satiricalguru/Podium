import { Fragment, lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Hand, Mic, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Link } from '../router';
import { useAuth } from '../auth/AuthContext';
import { useReducedMotion } from '../scene/Auditorium';
import { Wordmark } from '../ui/Wordmark';
import { gsap, ScrollTrigger, magnetic, useSmoothScroll } from './motion';

const HeroScene = lazy(() => import('./HeroScene'));

/** Splits text into masked words so headlines can rise line by line. */
function Words({ children, className }: { children: string; className?: string }) {
  const words = children.split(' ');
  return <>{words.map((word, i) => <Fragment key={i}><span className={`word ${className ?? ''}`}><span>{word}</span></span>{i < words.length - 1 && ' '}</Fragment>)}</>;
}

const chapters = [
  { n: '01', label: 'The empty room' },
  { n: '02', label: 'Your audience' },
  { n: '03', label: 'The feedback' },
  { n: '04', label: 'The podium' },
];

const scenarios = ['Keynotes', 'Product pitches', 'Thesis defences', 'Wedding toasts', 'All-hands', 'Job interviews', 'Conference talks', 'Impromptu answers'];

const features = [
  { n: '01', title: 'The room', body: 'A procedural, theatre-lit auditorium seen from behind a real lectern. Fill it with 24, 48 or 72 listeners who nod, drift and raise their hands.', visual: 'room' },
  { n: '02', title: 'The voice', body: 'Live transcription with speaking pace, filler phrases and a level meter — measured on your device, never recorded.', visual: 'voice' },
  { n: '03', title: 'The director', body: 'Optional Gemini direction turns your actual words into audience reactions and the question someone in row three would ask.', visual: 'director' },
  { n: '04', title: 'The reflection', body: 'Every rehearsal ends with one strength, one change for next time and a question to sharpen your thinking.', visual: 'reflection' },
] as const;

const moods = [
  { name: 'Supportive', tone: 'Friendly faces.', body: 'A warm room that leans in early. The right place for a first run, a new talk or a nervous Tuesday.', stat: '78%', statLabel: 'starting engagement' },
  { name: 'Neutral', tone: 'Prove it.', body: 'Attentive and professional. They wait for a concrete example before they give you their attention.', stat: '65%', statLabel: 'starting engagement' },
  { name: 'Challenging', tone: 'Tough questions.', body: 'Curious, sceptical and never cruel. Practise holding your ground when the room isn’t on your side yet.', stat: '52%', statLabel: 'starting engagement' },
];

function FeatureVisual({ kind }: { kind: typeof features[number]['visual'] }) {
  if (kind === 'room') return <div className="fv fv-room" aria-hidden="true">{Array.from({ length: 72 }, (_, i) => <i key={i} style={{ '--d': `${(i % 12) * 40 + Math.floor(i / 12) * 90}ms` } as CSSProperties} className={i < 48 ? 'on' : ''}/>)}<span className="fv-stage"/></div>;
  if (kind === 'voice') return <div className="fv fv-voice" aria-hidden="true">
    <div className="fv-wave">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ '--d': `${i * 70}ms`, '--h': `${20 + ((i * 37) % 70)}%` } as CSSProperties}/>)}</div>
    <p>So the real point is, <mark>um</mark>, that small steps compound. <mark>You know</mark>, every single day.</p>
    <div className="fv-chips"><span><b>138</b> wpm</span><span><b>2</b> fillers</span></div>
  </div>;
  if (kind === 'director') return <div className="fv fv-director" aria-hidden="true">
    <span className="fv-tag"><Hand size={13}/> Row 3 · seat 6</span>
    <p>“If I only had two minutes with your idea, which part would you cut first — and why?”</p>
    <span className="fv-meta"><Sparkles size={12}/> Audience question</span>
  </div>;
  return <div className="fv fv-reflection" aria-hidden="true">
    <div className="fv-grid"><div><b>04:52</b><span>Time</span></div><div><b>612</b><span>Words</span></div><div><b>131</b><span>WPM</span></div><div><b>3</b><span>Fillers</span></div></div>
    <div className="fv-note"><span>One thing for next time</span>Leave a two-second pause after your main point.</div>
  </div>;
}

function Nav({ hidden }: { hidden: boolean }) {
  const { user } = useAuth();
  const start = user ? '/studio' : '/signin';
  return <header className={`lnav ${hidden ? 'is-hidden' : ''}`}>
    <Link to="/" className="lnav-brand" aria-label="Podium home"><Wordmark/></Link>
    <nav className="lnav-links" aria-label="Sections">
      <a href="#manifesto">Why</a><a href="#features">Inside</a><a href="#moods">Audiences</a><a href="#privacy">Privacy</a>
    </nav>
    <div className="lnav-actions">
      {!user && <Link to="/signin" className="btn btn-ghost btn-sm">Sign in</Link>}
      <Link to={start} className="btn btn-lime btn-sm">{user ? 'Open studio' : 'Start rehearsing'}<ArrowUpRight size={15}/></Link>
    </div>
  </header>;
}

function Curtain({ done }: { done: boolean }) {
  return <div className={`curtain ${done ? 'is-open' : ''}`} aria-hidden="true">
    <div className="curtain-half left"/><div className="curtain-half right"/>
    <div className="curtain-mark"><Wordmark/><span className="curtain-note">Setting the stage</span></div>
  </div>;
}

export default function Landing() {
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [heroActive, setHeroActive] = useState(true);
  const [navHidden, setNavHidden] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [curtainOpen, setCurtainOpen] = useState(reduced);
  const startTo = user ? '/studio' : '/signin';

  useSmoothScroll(!reduced);

  // Open the curtain once the 3D room is ready (or after a short grace period).
  useEffect(() => {
    if (reduced) { setCurtainOpen(true); return; }
    const timer = setTimeout(() => setCurtainOpen(true), sceneReady ? 450 : 2600);
    return () => clearTimeout(timer);
  }, [sceneReady, reduced]);

  // Pause the WebGL loop when the hero is offscreen.
  useEffect(() => {
    const el = hero.current; if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setHeroActive(entry.isIntersecting), { rootMargin: '10% 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      // Page progress hairline + hide-on-scroll nav
      gsap.to('.scroll-progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } });
      ScrollTrigger.create({ start: 120, end: 'max', onUpdate: self => setNavHidden(self.direction === 1 && self.scroll() > 400) });

      // Hero: drive the camera and crossfade chapters with one scrubbed timeline.
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: hero.current, start: 'top top', end: 'bottom bottom', scrub: reduced ? true : .6, onUpdate: self => { progress.current = self.progress; } },
      });
      const out = { autoAlpha: 0, y: -60, filter: 'blur(8px)', duration: .06 };
      const into = { autoAlpha: 0, y: 70, filter: 'blur(8px)', duration: .06 };
      tl.to('.ch-0', out, .1)
        .to('.hero-hint', { autoAlpha: 0, duration: .04 }, .04)
        .from('.ch-1', into, .22).to('.ch-1', out, .43)
        .from('.ch-2', into, .5).from('.hud-chip', { autoAlpha: 0, y: 30, stagger: .015, duration: .05 }, .53).to(['.ch-2', '.hud-chip'], out, .72)
        .from('.ch-3', into, .86)
        .set({}, {}, 1);
      chapters.forEach((_, i) => {
        tl.to(`.rail-step:nth-child(${i + 1})`, { '--fill': 1, duration: i === 0 ? .2 : .24 }, [0, .2, .45, .76][i]);
      });

      // Intro headline rise
      if (!reduced) gsap.from(q('.ch-0 .word > span'), { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: .05, delay: .55 });

      // Manifesto: words light up as you read
      gsap.fromTo(q('.manifesto .word > span'), { opacity: .14 }, { opacity: 1, stagger: .5, ease: 'none', scrollTrigger: { trigger: '.manifesto-text', start: 'top 78%', end: 'bottom 45%', scrub: true } });

      // Section headings rise in
      q('[data-rise]').forEach(el => gsap.from(el, { y: 60, autoAlpha: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));

      // Marquee speeds up and reverses with scroll velocity
      const marquee = gsap.to('.marquee-track', { xPercent: -50, ease: 'none', duration: 38, repeat: -1 });
      if (reduced) marquee.pause();
      else ScrollTrigger.create({ onUpdate: self => {
        const v = self.getVelocity() / 260;
        gsap.to(marquee, { timeScale: self.direction * Math.max(1, Math.min(6, Math.abs(v))), duration: .25, overwrite: true });
        gsap.to('.marquee-track', { skewX: Math.max(-8, Math.min(8, -v)), duration: .4, overwrite: 'auto' });
      } });

      // Features: horizontal pinned scroll on wide screens, simple reveals on small ones
      const mm = gsap.matchMedia();
      mm.add('(min-width: 900px)', () => {
        const track = document.querySelector<HTMLElement>('.features-track');
        if (!track) return;
        const distance = () => track.scrollWidth - window.innerWidth + 64;
        gsap.to(track, { x: () => -distance(), ease: 'none', scrollTrigger: { trigger: '.features-pin', start: 'top top', end: () => `+=${distance()}`, pin: true, scrub: reduced ? true : .8, invalidateOnRefresh: true, anticipatePin: 1 } });
      });

      // Stacking audience cards scale back as the next one arrives
      q('.mood-card').forEach((card, i, all) => {
        if (i === all.length - 1) return;
        gsap.to(card, { scale: .92, filter: 'brightness(.55)', ease: 'none', scrollTrigger: { trigger: all[i + 1], start: 'top bottom', end: 'top 20%', scrub: true } });
      });

      // Number counters
      q('[data-count]').forEach(el => {
        const target = Number(el.dataset.count);
        const counter = { v: 0 };
        gsap.to(counter, { v: target, duration: reduced ? 0 : 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' }, onUpdate: () => { el.textContent = String(Math.round(counter.v)); } });
      });

      // Finale headline scales up into view
      gsap.fromTo('.finale-title', { scale: .82, yPercent: 20 }, { scale: 1, yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.finale', start: 'top bottom', end: 'center center', scrub: true } });
    }, root);
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    return () => ctx.revert();
  }, [reduced]);

  // Magnetic CTAs
  useEffect(() => {
    if (reduced) return;
    const cleanups = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-magnetic]') ?? []).map(el => magnetic(el));
    return () => cleanups.forEach(fn => fn());
  }, [reduced]);

  return <div className="landing" ref={root}>
    {!reduced && <Curtain done={curtainOpen}/>}
    <div className="scroll-progress" aria-hidden="true"/>
    <Nav hidden={navHidden}/>

    <main>
      <section className="hero" ref={hero} aria-label="Podium introduction">
        <div className="hero-sticky">
          <div className="hero-canvas">
            <Suspense fallback={<div className="hero-fallback"/>}>
              <HeroScene progress={progress} active={heroActive} reduced={reduced} onReady={() => setSceneReady(true)}/>
            </Suspense>
          </div>
          <div className="hero-vignette" aria-hidden="true"/>
          <div className="hero-grain" aria-hidden="true"/>

          <div className="chapter ch-0">
            <p className="eyebrow"><span className="dot"/>A rehearsal studio for public speaking</p>
            <h1 className="display"><Words>Every great talk starts in an</Words> <em className="serif"><Words>empty room.</Words></em></h1>
            <div className="hero-cta">
              <Link to={startTo} className="btn btn-lime btn-lg" data-magnetic>Start rehearsing<ArrowRight size={18}/></Link>
              <a href="#manifesto" className="btn btn-ghost btn-lg">Why Podium</a>
            </div>
          </div>
          <div className="chapter ch-1 ch-side">
            <span className="mono">02 — Your audience</span>
            <h2 className="display-md">Fill it with <em className="serif">people.</em></h2>
            <p className="lede">Up to 72 procedurally animated listeners. They nod when you land a point, drift when you ramble and raise a hand when they’re curious.</p>
          </div>
          <div className="chapter ch-2 ch-side ch-right">
            <span className="mono">03 — The feedback</span>
            <h2 className="display-md">Feel the room <em className="serif">lean in.</em></h2>
            <p className="lede">Pace, filler phrases and simulated engagement update as you speak — quiet signals, never a scoreboard.</p>
          </div>
          <div className="hud" aria-hidden="true">
            <div className="hud-chip" style={{ '--x': '8%', '--y': '24%' } as CSSProperties}><span className="mono">Pace</span><b>138</b><small>wpm</small></div>
            <div className="hud-chip" style={{ '--x': '14%', '--y': '58%' } as CSSProperties}><span className="mono">Engagement</span><b>82%</b><small className="bar"><i style={{ width: '82%' }}/></small></div>
            <div className="hud-chip" style={{ '--x': '30%', '--y': '76%' } as CSSProperties}><span className="mono">Fillers</span><b>2</b><small>detected</small></div>
          </div>
          <div className="chapter ch-3">
            <span className="mono">04 — The podium</span>
            <h2 className="display"><Words>The floor is</Words> <em className="serif">yours.</em></h2>
            <div className="hero-cta center">
              <Link to={startTo} className="btn btn-lime btn-lg" data-magnetic>Take the stage<ArrowRight size={18}/></Link>
            </div>
          </div>

          <ol className="hero-rail" aria-hidden="true">
            {chapters.map(c => <li key={c.n} className="rail-step"><span className="mono">{c.n}</span><i/><span className="rail-label">{c.label}</span></li>)}
          </ol>
          <div className="hero-hint mono" aria-hidden="true"><ArrowDown size={14}/>Scroll to step inside</div>
        </div>
      </section>

      <section className="manifesto section" id="manifesto">
        <span className="mono section-label">The problem</span>
        <p className="manifesto-text">
          <Words>Most people rehearse to a mirror. A mirror never looks away, never asks a hard question, never loses interest at minute four.</Words>{' '}
          <em className="serif"><Words>Podium does — gently,</Words></em>{' '}<Words>so the real room feels familiar.</Words>
        </p>
      </section>

      <section className="marquee" aria-label="What people rehearse">
        <div className="marquee-track">
          {[...scenarios, ...scenarios].map((s, i) => <span key={i} aria-hidden={i >= scenarios.length}>{s}<i>✳</i></span>)}
        </div>
      </section>

      <section className="features" id="features" aria-label="Inside Podium">
        <div className="features-pin">
          <div className="features-head">
            <span className="mono section-label">Inside the studio</span>
            <h2 className="display-md" data-rise>Four quiet tools.<br/><em className="serif">One loud room.</em></h2>
          </div>
          <div className="features-track">
            {features.map(f => <article className="feature" key={f.n}>
              <div className="feature-top"><span className="mono">{f.n}</span><span className="mono">{f.title}</span></div>
              <FeatureVisual kind={f.visual}/>
              <div className="feature-copy"><h3>{f.title}</h3><p>{f.body}</p></div>
            </article>)}
          </div>
        </div>
      </section>

      <section className="moods section" id="moods">
        <div className="moods-head">
          <span className="mono section-label">Choose your audience</span>
          <h2 className="display-md" data-rise>Same talk.<br/><em className="serif">Three different rooms.</em></h2>
        </div>
        <div className="mood-stack">
          {moods.map((m, i) => <article className="mood-card" key={m.name} style={{ '--i': i } as CSSProperties}>
            <div className="mood-index mono">0{i + 1} / 03</div>
            <div className="mood-main">
              <h3>{m.name}</h3>
              <p className="mood-tone serif">{m.tone}</p>
              <p className="mood-body">{m.body}</p>
            </div>
            <div className="mood-stat"><b>{m.stat}</b><span className="mono">{m.statLabel}</span></div>
          </article>)}
        </div>
      </section>

      <section className="numbers section" aria-label="Podium in numbers">
        <div className="number"><b><span data-count="72">72</span></b><span>listeners in the largest room, each animated on its own</span></div>
        <div className="number"><b><span data-count="140">140</span><small>wpm</small></b><span>the middle of the comfortable pace range Podium listens for</span></div>
        <div className="number"><b><span data-count="0">0</span></b><span>seconds of audio recorded or stored. Ever.</span></div>
        <div className="number"><b><span data-count="3">3</span><small>min</small></b><span>is all a first rehearsal takes</span></div>
      </section>

      <section className="privacy section" id="privacy">
        <div className="privacy-icon"><ShieldCheck size={22}/></div>
        <h2 className="display-md" data-rise>Your voice <em className="serif">stays yours.</em></h2>
        <div className="privacy-grid">
          <div><Mic size={18}/><h3>No recordings</h3><p>Podium measures levels and words in the moment. Audio is never saved or uploaded by Podium.</p></div>
          <div><Users size={18}/><h3>Your history, your device</h3><p>Session reflections live in your browser, separated per account. Export or delete them any time.</p></div>
          <div><Sparkles size={18}/><h3>AI only when you say so</h3><p>Gemini is off by default. Turn it on and only transcript excerpts are sent — never audio.</p></div>
        </div>
      </section>

      <section className="finale" onPointerMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}>
        <span className="mono section-label">Your cue</span>
        <h2 className="finale-title">Take the <em className="serif">stage.</em></h2>
        <p className="lede">Free, private, and ready in your browser.</p>
        <Link to={startTo} className="btn btn-lime btn-xl" data-magnetic>{user ? 'Open your studio' : 'Start rehearsing'}<ArrowRight size={20}/></Link>
      </section>
    </main>

    <footer className="lfooter">
      <Wordmark/>
      <span>Made for the moments before the big moment.</span>
      <nav aria-label="Footer"><Link to="/signin">Sign in</Link><a href="#privacy">Privacy</a><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}>Back to top</button></nav>
    </footer>
  </div>;
}
