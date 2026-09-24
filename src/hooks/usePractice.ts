import { useCallback, useEffect, useRef, useState } from 'react';
import type { InputMode } from '../lib/analysis';
import type { Recognition, SessionStatus } from '../lib/types';

export function usePractice(mode: InputMode) {
  const [status, setStatus] = useState<SessionStatus>('ready');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [micState, setMicState] = useState('Microphone off');
  const [inputError, setInputError] = useState('');
  const [sessionId, setSessionId] = useState(0);
  const elapsed = useRef(0);
  const append = useCallback((text: string) => setTranscript(prev => [prev, text.trim()].filter(Boolean).join(' ')), []);
  useEffect(() => {
    if (status !== 'running') return;
    const start = performance.now();
    const before = elapsed.current;
    const timer = window.setInterval(() => setSeconds(before + (performance.now() - start) / 1000), 150);
    return () => { clearInterval(timer); elapsed.current = before + (performance.now() - start) / 1000; setSeconds(elapsed.current); };
  }, [status]);
  useEffect(() => {
    if (status !== 'running' || mode !== 'voice' || muted) { setLevel(0); setInterim(''); setMicState(muted ? 'Microphone muted' : 'Microphone off'); if(mode==='typed')setInputError(''); return; }
    let disposed = false;
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    let recognition: Recognition | undefined;
    let frame = 0;
    let restart = 0;
    let meterAt = 0;
    const permissionTimer=window.setTimeout(()=>{if(!disposed&&!stream)setInputError('Microphone permission is still pending. Allow access in your browser, or switch to typed rehearsal.');},10000);
    const cleanup = () => {
      disposed = true;
      clearTimeout(permissionTimer);
      clearTimeout(restart);
      if (recognition) { recognition.onend = null; recognition.onresult = null; recognition.onerror = null; recognition.abort(); }
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach(track => track.stop());
      if (context && context.state !== 'closed') void context.close();
    };
    setInputError(''); setMicState('Connecting microphone…');
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone unavailable. Use typed rehearsal, or open this app on localhost/HTTPS.');
        const acquired = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}, video: false});
        if (disposed) { acquired.getTracks().forEach(t => t.stop()); return; }
        stream = acquired;
        clearTimeout(permissionTimer); setInputError('');
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) throw new Error('AudioContext unavailable in this browser.');
        context = new AudioContextClass();
        await context.resume();
        if (disposed) { if (context.state !== 'closed') void context.close(); return; }
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const measure = (now: number) => {
          if (disposed) return;
          if (now - meterAt > 70) { analyser.getByteTimeDomainData(data); const rms = Math.sqrt(data.reduce((sum,v) => sum + ((v-128)/128)**2,0)/data.length); setLevel(Math.min(1,rms*5)); meterAt = now; }
          frame = requestAnimationFrame(measure);
        };
        frame = requestAnimationFrame(measure); setMicState('Microphone listening');
        const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Constructor) { setInputError('Live transcription is unavailable in this browser. Your mic level still works; switch to typed rehearsal for text feedback.'); return; }
        recognition = new Constructor(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = navigator.language || 'en-US';
        let fatalError = false;
        recognition.onresult = event => {
          if (disposed) return;
          let draft = '';
          for (let i=event.resultIndex; i<event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) append(result[0].transcript); else draft += result[0].transcript;
          }
          setInterim(draft);
        };
        recognition.onerror = event => {
          if (disposed || event.error === 'no-speech' || event.error === 'aborted') return;
          fatalError = true;
          setInputError('Transcription could not connect. You can continue with audio levels, or switch to typed rehearsal.');
        };
        recognition.onend = () => { if (!disposed && !fatalError) restart = window.setTimeout(() => { if (!disposed) try { recognition?.start(); } catch { /* recognition may already be active */ } }, 300); };
        recognition.start();
      } catch (error) {
        if (disposed) return;
        cleanup(); setLevel(0); setMicState('Microphone unavailable');
        setInputError(error instanceof Error && error.message.startsWith('Microphone unavailable.') ? error.message : 'Microphone access was not available. End this session and choose typed rehearsal, or enable microphone access in your browser.');
      }
    })();
    return cleanup;
  }, [status, mode, muted, append, sessionId]);
  const start = () => { elapsed.current = 0; setSeconds(0); setTranscript(''); setInterim(''); setInputError(''); setMuted(false); setSessionId(n=>n+1); setStatus('running'); };
  const reset = () => { setStatus('ready'); setTranscript(''); setInterim(''); setSeconds(0); elapsed.current=0; setInputError(''); setMuted(false); setSessionId(n=>n+1); };
  return {status, seconds, transcript, interim, muted, level, micState, inputError, sessionId, append, start, reset, setMuted, pause:()=>setStatus('paused'), resume:()=>setStatus('running'), end:()=>setStatus('completed')};
}
