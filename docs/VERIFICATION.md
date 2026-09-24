# Initial version verification

17 September 2026

## Automated checks

- `npm run build`: passed TypeScript and Vite production compilation.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: passed.
- `npm test`: 9/9 passed. Covers Unicode/combining-mark word counting, filler word boundaries, withheld pace for short/typed samples, bounded audience heuristics and bounded Gemini request/response schemas.
- Live local HTTP checks: health/configuration 200, configured-key absence 503 with safe fallback message, invalid request 400, cross-origin request 403, excessive body size 413.
- Dependency installation audit: no vulnerabilities reported at installation.

## Browser checks

Verified in the Codex in-app browser using its Playwright and native accessibility/screenshot surfaces:

1. Auditorium renders as an actual WebGL scene with a visible microphone, lectern, raked seats and independently animated people. No browser error/warning logs in the observed session.
2. Audience sizes, temperament and input mode controls update; settings lock during practice.
3. A 51-word typed sample produced two filler detections, a transcript-driven change in simulated engagement, and no fabricated speaking pace.
4. Timer froze at `00:17` while paused, including during independent testing work, then resumed.
5. Requested local audience question appeared in the room. Focus mode retained timer, essential controls, question and a speaker note.
6. End generated a local reflection with the actual 51-word transcript, time, filler count and unavailable voice measurements.
7. Completed history remained present after page reload.
8. Microphone input connected, but the browser's recognition service could not connect. The visible error offered a typed fallback. Switching modes released the audio capture path and preserved the running practice; added text appeared in the completed reflection.
9. Repeat practice reset timer and transcript. Gemini enable control with no configured key displayed explicit server setup instructions.
10. At a 390×844 viewport, document width was 390px (no horizontal overflow) and the Start control was within the first viewport. Room, metrics, input and setup stacked coherently.

## Limits and performance notes

- Real Gemini provider responses have not been tested because no key was supplied. SDK usage, response schema validation and missing-key/error behavior are implemented; provider availability, latency and model cost remain to be verified with credentials.
- No real spoken transcript was captured through the in-app browser's unavailable recognition service. The actual failure/fallback path was tested. Browser recognition support and language accuracy vary.
- Full-duplex Gemini Live streaming, photorealistic character assets, recordings, gaze analysis and WebXR are follow-up milestones, not implemented features.
- The 3D engine is loaded separately from the UI. Vite reports a large-chunk advisory for the room/Three.js bundle (~883KB before compression, ~239KB gzip); the UI bundle is ~297KB before compression/~88KB gzip. Further production work should profile low-end mobile hardware and explore engine caching/LOD.
- Repeated room/body geometry uses three instanced batches; chairs use shared cached materials. Device pixel ratio is bounded to 1.5 and audience size to 72. Reduced-motion settings stop listener animations and pointer parallax.
- Primary control text contrast was checked numerically (white on `#c94c2c`: 4.61:1), with darker secondary labels and expanded mobile targets. This was not a complete external accessibility audit.

## Gemini configuration follow-up

The supplied key was saved only in the ignored, owner-readable `.env` file (`0600`). The production frontend bundle was scanned and does not contain the key. Model enumeration authenticated successfully and includes `gemini-3.8-flash`.

Google's current model/pricing documentation identifies 3.8 as the strongest Flash model and lists free-tier text input/output. It is now the primary audience model with low thinking, a 12-second primary timeout, and 20-second background request spacing. Gemini 2.5 Flash is the only automatic fallback for primary 429/503/504 errors; it also has free-tier text input/output and uses an 8-second timeout with thinking disabled. The responding model is returned by the API and displayed after audience reactions. Authentication errors do not trigger silent model changes.

A direct 3.8 request returned a valid live JSON question; a direct 2.5 request returned a complete valid audience JSON object. Repeated full endpoint checks subsequently encountered provider high-demand errors. End-to-end coaching availability is therefore not claimed to be consistently verified: when both free models are unavailable, the app retains local reactions and guidance. No billing changes were made and no paid-only model is selected as a fallback. Actual free-tier quotas remain controlled by the Google project.

All 12 automated tests and the production build pass after the follow-up. The three added tests cover primary selection, the bounded free fallback, and the absence of fallback for authentication errors/custom models. Browser inspection confirmed model detection and an enabled Gemini switch.
