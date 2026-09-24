# Podium — researched building plan

17 September 2026 · Initial local web application

## Product goal

Let a speaker stand at a virtual podium, practise a talk, and experience a responsive audience. The core loop is **prepare → speak → observe → reflect → repeat**. Open directly on the practice workspace, not a marketing page. The room and audience should occupy most of the screen; setup and coaching remain secondary.

## Research and implications

1. **Presence matters, but reactions must be credible.** The paper *Evaluating the Effect of Audience in a Virtual Reality Presentation Training Tool* studies audience effects in presentation practice. Treat immersion as a design hypothesis, not a claim that this app cures anxiety. Build actual depth, first-person perspective, and diverse independently animated listeners. [Primary research](https://arxiv.org/abs/2010.06077).
2. **Questions and coaching complete the practice loop.** VirtualSpeech's documented workflow proceeds from a speech into AI questions or coaching. Separate quiet speaking practice from optional audience questions, and finish with actionable feedback rather than an unexplained grade. [Practice workflow](https://support.virtualspeech.com/Starting%20and%20Ending%20your%20Speech-850ae973-1ff1-423b-9a56-74c83c9ddd1b), [Audience questions](https://support.virtualspeech.com/Live%20Audience%20Questions-6ff728d5-6cf1-4e02-a044-aba6133485e0).
3. **Gemini is suitable for a shared audience director.** Google's structured outputs support JSON-schema responses. Request bounded audience reactions, a content-specific question, and one coaching cue. The renderer owns animation and smooths changes; a model never controls scene code. [Google structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).
4. **Live voice is a later transport, not a per-person model.** Gemini Live supports continuous audio/text, transcription and low-latency voice via WebSockets. Browser production clients need short-lived server-issued tokens rather than permanent API keys. A single director plus several audience personas avoids dozens of simultaneous model sessions. [Live API](https://ai.google.dev/gemini-api/docs/live-api), [Ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens).
5. **Speech recognition requires a fallback.** Browser SpeechRecognition has limited availability and may send audio to a browser vendor's recognition service. Explain this before microphone activation. Provide an explicit typed rehearsal option; never manufacture a transcript or delivery score when recognition is unavailable. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

## Visual and interaction direction

**A contemporary rehearsal studio:** warm ivory chrome, charcoal typography, restrained vermilion controls, warm timber and sage upholstery inside the room. Use Manrope for the product UI and a contrasting editorial serif for key headings. Finely separated surfaces, meaningful whitespace, compact labeled icons, and a cinematic room give it character without making the practice controls difficult to find.

Desktop: a compact left navigation rail; context bar; large live room beside a setup panel; microphone/timer controls immediately under the room; quiet metric strip and transcript/notes below. Mobile: stacked room and controls, setup below, minimum 44px touch targets. Focus mode expands the room and retains essential session controls. Motion respects reduced-motion preferences.

First-person viewpoint: camera at speaker eye height behind a visible wooden lectern and gooseneck microphone; raked audience seating, center aisle, acoustic timber wall panels, suspended lighting and exit markers. Procedural low-poly people establish a cohesive visual language without downloaded assets or unlicensed likenesses.

## Scope of the first version

### Prepare

- Select one of three scenarios: keynote, product pitch, or impromptu talk; edit the actual topic.
- Audience size options: 24, 48, and 72, reflected in scene population.
- Supportive, neutral, and challenging audience temperaments.
- Three practice lengths; speaker notes; voice or typed rehearsal input.
- Clearly expose whether local reactions or Gemini are active.

### Practise

- Ready, starting, speaking, paused, and completed session states.
- User-initiated microphone access; live Web Audio level meter; browser recognition where available.
- Timer, pause/resume, end session, microphone mute, room focus, and reset-view controls.
- Locally computed word count, pace, fillers, and input level with honest unavailable states.
- Deterministic audience model based on available delivery observations. Engagement is explicitly a simulation, not an objective human judgment.
- Listeners nod when engaged, shift/look away when distracted, and raise a hand for a requested question. No constant cheering or interruption during a talk.
- Optional Gemini reactions using recent transcript, audience temperament, topic and measured pace. Requests are throttled to once every 20 seconds; stale results and failures cannot overwrite a newer session.
- Request an audience question explicitly; display it and optionally read it with browser speech synthesis.
- A typed transcript input supports browsers without speech recognition and makes the experience reviewable without microphone access. Typed input has no acoustic measurements.

### Reflect

- Session report with observed word count, time, pace/fillers when meaningful, transcript, strengths and a next practice action.
- Gemini coaching if configured and enabled; otherwise clearly labeled local guidance grounded in actual observed data.
- Store up to 20 reports in browser local storage; expose history and delete controls.
- Export a report as a local JSON file; repeat practice returns to the room.

## Architecture

- React + TypeScript + Vite for the interface.
- Three.js through React Three Fiber for real-time scene rendering; shared geometries/materials, bounded scene population and device pixel ratio.
- Small Express backend with the Google GenAI SDK. `GEMINI_API_KEY` stays on the server; it is never exposed through `VITE_*`, committed, or requested in the UI.
- `/api/health` advertises configuration; `/api/audience` returns validated JSON for reaction/question/feedback modes. Cap text length and request size; bounded concurrency and per-client request rate; request timeout; safe error responses.
- Shared pure delivery-analysis functions and a single audience-state owner. Scene presentation never determines report metrics.
- Run frontend and backend together locally; serve compiled frontend from the backend for a production build.
- No accounts, audio recordings or camera access in the initial version. Browser transcript/history stay on-device; enabling Gemini sends transcript excerpts to Google. Browser speech recognition may use the browser provider's service.

## State and measurement rules

- An active session locks scenario configuration. Pausing stops timer, microphone and recognition; resuming starts a new capture segment without losing transcript.
- Full microphone cleanup on end, unmount, mute and errors. Muting prevents audio capture and recognition rather than merely hiding the level indicator.
- Session time is active wall-clock time, not number of rendered frames.
- Word pace is transcript words / active minutes. Very short sessions are labeled preliminary. Fillers use explicit word-boundary matching; do not penalize accents or infer emotions.
- Engagement starts at a temperament-dependent baseline. Local changes are bounded and smoothed. Gemini may suggest a state but validated values and animation limits stay in application code.
- Never report eye contact, facial affect, confidence, pronunciation or posture without actual sensors and validated analysis.
- Typed rehearsals report text observations; their elapsed input rate is not presented as speaking pace.
- History parse failures and storage limits fail gracefully without blocking practice.

## Build sequence

1. **Research and plan:** this document, scope, sources, architecture and acceptance criteria.
2. **Room and working surface:** scaffold application, procedural 3D auditorium, responsive studio UI and real configuration controls.
3. **Session engine:** timer, input capture/fallback, transcript, analysis, local reactions and focus mode.
4. **Gemini adapter:** server-only key configuration, schema validation, throttled audience direction, requested questions and grounded coaching.
5. **Review and persistence:** complete report, history, local export and retry flow.
6. **Verification:** typecheck/build; core analysis/state and backend safety checks; browser interaction and responsive visual review; document limitations.

## Acceptance criteria

- On opening the app, a complete room renders from the podium and all primary practice controls are visible.
- Changing audience size visibly changes the number of listeners; temperament changes reaction baselines.
- Typed practice works with no API key or microphone; voice mode gracefully handles permission denial/unsupported recognition.
- Paused sessions do not advance time or capture speech; finished sessions release every audio resource.
- Ending a session produces a report based on the actual transcript and elapsed active time; history survives a reload and can be deleted.
- An AI question refers to the topic/transcript if Gemini is enabled, and local questions are identified as local.
- Gemini failure leaves the current room and local reactions usable, with an honest visible status.
- Keyboard-accessible controls, labeled form fields, visible focus indicators, sufficient contrast, reduced motion, and usable narrow-screen layout.
- TypeScript and production build pass; microphone-free practice, pause/resume, question, report, repeat and history verified in a real browser.

## Next milestones after the first working version

- Integrate Gemini Live using backend-issued ephemeral tokens, AudioWorklet PCM capture and bounded playback queues; verify provider availability and costs at implementation time.
- Add richer rigged characters with professionally licensed assets and animation blending.
- Evaluate reaction realism with practising speakers; tune interruptions for supportive vs challenging scenarios.
- Add optional slide import/presentation and explicit replay recording only after defining data retention and user controls.
- WebXR can be considered after the desktop speaking loop is validated; do not require a headset for first use.

## Known boundaries

This version is a rehearsal tool, not an assessment of clinical anxiety or a validated predictor of real audience sentiment. Low-poly procedural characters prioritize performance and interaction over photorealism. Gemini requires a configured server key and network access; without credentials the app remains fully usable with labeled local reactions. Browser speech support differs; typed practice is always available. Full duplex Gemini Live voice and gaze tracking are follow-up milestones, not claimed initial capabilities.
