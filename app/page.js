'use client';

import { useEffect, useRef, useState } from 'react';
import {
  useRive,
  useStateMachineInput,
  Layout,
  Fit,
  Alignment,
} from '@rive-app/react-webgl2';

import MRQ_TIMELINE from './mrq-timeline.json';
import MRQ_TEXT from './mrq-text.json';

// ---- Names exactly as they appear in ms_i.riv / mr_q.riv ----
const BODY_STATES = [
  { value: 0, label: 'Idle', anim: 'IDLE' },
  { value: 1, label: 'Thinking', anim: 'THINKING' },
  { value: 2, label: 'Talking', anim: 'RESPONDING / TALKING' },
];

const EYEBROWS = [
  { value: 0, label: 'Neutral', anim: 'Eyebrow_Neutral' },
  { value: 100, label: 'Thinking', anim: 'Eyebrow_Thinking' },
  { value: 200, label: 'Curious', anim: 'Eyebrow_Curious' },
];

const visemeList = (closedAnim) => [
  { n: 0, name: 'Neutral', anim: 'Viseme_00_Neutral' },
  { n: 1, name: 'Closed', anim: closedAnim },
  { n: 2, name: 'E / EH', anim: 'Viseme_02_E_EH' },
  { n: 3, name: 'A / AA', anim: 'Viseme_03_A_AA' },
  { n: 4, name: 'I / EE', anim: 'Viseme_04_I_EE' },
  { n: 5, name: 'L', anim: 'Viseme_05_L' },
  { n: 6, name: 'F / V', anim: 'Viseme_06_F_V' },
  { n: 7, name: 'O', anim: 'Viseme_07_O' },
  { n: 8, name: 'U / OO', anim: 'Viseme_08_U_OO' },
  { n: 9, name: 'TH', anim: 'Viseme_09_TH' },
  { n: 10, name: 'S / Z', anim: 'Viseme_10_S_Z' },
  { n: 11, name: 'D / T / N', anim: 'Viseme_11_D_T_N' },
  { n: 12, name: 'SH / CH / J', anim: 'Viseme_12_SH_CH_J' },
  { n: 13, name: 'W / Q', anim: 'Viseme_13_W_Q' },
  { n: 14, name: 'Smile', anim: 'Viseme_14_Smile_Soft_Open' },
];

// The .riv files are not in /public and not behind a public URL. They live in a PRIVATE
// Supabase bucket and are served by the server route app/api/rive/route.js.
// Durations are the real lengths of the mp3 files.
const CHARACTERS = {
  ms_i: {
    id: 'ms_i',
    name: 'Ms I',
    file: 'ms_i.riv',
    sm: 'Ms I Controller',
    eyebrowInput: 'EyebrowState',
    visemeLayer: 'Mouth Visemes',
    riveUrl: '/api/rive?c=ms_i',
    visemes: visemeList('Viseme_01_Closed'),
    audioBase: '/audio/',
    // Audio-driven lip sync only (no transcript available for these clips).
    clips: [
      { id: '02', dur: 4.3 },
      { id: '03', dur: 4.2 },
      { id: '04', dur: 4.8 },
      { id: '05', dur: 4.8 },
      { id: '06', dur: 3.4 },
      { id: '07', dur: 6.8 },
      { id: '08', dur: 14.7 },
      { id: '09', dur: 3.4 },
      { id: '10', dur: 5.8 },
    ],
  },
  mr_q: {
    id: 'mr_q',
    name: 'Mr Q',
    file: 'mr_q.riv',
    sm: 'Mr Q Controller',
    eyebrowInput: 'EyebrowState',
    visemeLayer: 'Visemes',
    riveUrl: '/api/rive?c=mr_q',
    visemes: visemeList('Viseme_01_Closed_M_B_P'),
    audioBase: '/audio/mrq/',
    timelines: MRQ_TIMELINE, // text based viseme timeline per clip, see app/mrq-timeline.json
    clips: [
      { id: '01', dur: 5.5 },
      { id: '02', dur: 3.9 },
      { id: '03', dur: 2.0 },
      { id: '04', dur: 2.0 },
      { id: '05', dur: 2.3 },
      { id: '06', dur: 3.5 },
      { id: '07', dur: 3.3 },
      { id: '08', dur: 9.2 },
      { id: '09', dur: 7.1 },
      { id: '10', dur: 6.5 },
      { id: '11', dur: 2.9 },
      { id: '12', dur: 4.4 },
    ].map((c) => ({ ...c, text: MRQ_TEXT[c.id] })),
  },
};
const CHAR_ORDER = ['ms_i', 'mr_q'];

const layout = new Layout({ fit: Fit.Contain, alignment: Alignment.Center });

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function Page() {
  const [charId, setCharId] = useState('ms_i');
  const cfg = CHARACTERS[charId];
  const switcher = (
    <div className="char-switch" role="tablist" aria-label="Character">
      {CHAR_ORDER.map((id) => (
        <button
          key={id}
          role="tab"
          aria-selected={charId === id}
          className={`char-btn ${charId === id ? 'on' : ''}`}
          onClick={() => setCharId(id)}
        >
          {CHARACTERS[id].name}
        </button>
      ))}
    </div>
  );
  // key = remount: loads the other .riv, resets inputs and stops any playing audio
  return <CharacterDemo key={charId} cfg={cfg} switcher={switcher} />;
}

function CharacterDemo({ cfg, switcher }) {
  const SM = cfg.sm;
  const VISEMES = cfg.visemes;
  const CLIPS = cfg.clips;

  const { rive, RiveComponent } = useRive({
    src: cfg.riveUrl,
    stateMachines: SM,
    autoplay: true,
    autoBind: true,
    layout,
  });

  const eyebrowIn = useStateMachineInput(rive, SM, cfg.eyebrowInput);
  const blinkIn = useStateMachineInput(rive, SM, 'Blink');
  const lookXIn = useStateMachineInput(rive, SM, 'LookX');
  const lookYIn = useStateMachineInput(rive, SM, 'LookY');
  const bodyIn = useStateMachineInput(rive, SM, 'BodyState');
  const ackIn = useStateMachineInput(rive, SM, 'Acknowledge');
  const mouthIn = useStateMachineInput(rive, SM, 'MouthViseme');

  const ready = !!(eyebrowIn && blinkIn && lookXIn && lookYIn && bodyIn && ackIn && mouthIn);

  const [body, setBody] = useState(0);
  const [eyebrow, setEyebrow] = useState(0);
  const [look, setLook] = useState({ x: 50, y: 50 });
  const [viseme, setViseme] = useState(0);
  const [playing, setPlaying] = useState(null);
  const [counts, setCounts] = useState({ blink: 0, ack: 0 });

  // keep latest inputs available to the audio loop
  const mouthRef = useRef(null);
  const bodyRef = useRef(null);
  useEffect(() => { mouthRef.current = mouthIn; }, [mouthIn]);
  useEffect(() => { bodyRef.current = bodyIn; }, [bodyIn]);

  useEffect(() => { if (bodyIn) bodyIn.value = body; }, [bodyIn, body]);
  useEffect(() => { if (eyebrowIn) eyebrowIn.value = eyebrow; }, [eyebrowIn, eyebrow]);
  useEffect(() => {
    if (lookXIn) lookXIn.value = look.x;
    if (lookYIn) lookYIn.value = look.y;
  }, [lookXIn, lookYIn, look]);

  const applyViseme = (n) => {
    if (mouthRef.current) mouthRef.current.value = n;
    setViseme(n);
  };

  const fireBlink = () => {
    if (blinkIn) blinkIn.fire();
    setCounts((c) => ({ ...c, blink: c.blink + 1 }));
  };
  const fireAck = () => {
    if (ackIn) ackIn.fire();
    setCounts((c) => ({ ...c, ack: c.ack + 1 }));
  };

  // ---------- look pad ----------
  const padRef = useRef(null);
  const dragging = useRef(false);
  const moveLook = (e) => {
    const r = padRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
    const y = clamp(100 - ((e.clientY - r.top) / r.height) * 100, 0, 100);
    setLook({ x: Math.round(x), y: Math.round(y) });
  };

  // ---------- audio + lip sync ----------
  const audioRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const lastSwitch = useRef(0);
  const lastViseme = useRef(0);
  const playingRef = useRef(null);

  const stopLoop = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const loop = () => {
    const an = analyserRef.current;
    if (!an) return;
    const td = new Uint8Array(an.fftSize);
    const fd = new Uint8Array(an.frequencyBinCount);
    an.getByteTimeDomainData(td);
    an.getByteFrequencyData(fd);

    let sum = 0;
    for (let i = 0; i < td.length; i++) {
      const v = (td[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / td.length);

    let num = 0;
    let den = 0;
    const binHz = ctxRef.current.sampleRate / an.fftSize;
    for (let i = 0; i < fd.length; i++) {
      num += i * binHz * fd[i];
      den += fd[i];
    }
    const centroid = den > 0 ? num / den : 0;

    let next;
    const tl = cfg.timelines && playingRef.current ? cfg.timelines[playingRef.current] : null;
    if (tl && audioRef.current) {
      // text based viseme timeline, gated by the real loudness so silence = closed mouth
      const t = audioRef.current.currentTime;
      let v = 0;
      for (let i = 0; i < tl.length && tl[i][0] <= t; i++) v = tl[i][1];
      next = rms < 0.012 ? 0 : v;
    } else if (rms < 0.015) next = 0;
    else if (rms < 0.05) next = 1;
    else if (centroid > 3200) next = 10;
    else if (centroid > 2200) next = 4;
    else if (centroid > 1500) next = 2;
    else if (centroid > 1000) next = 3;
    else if (centroid > 700) next = 7;
    else next = 8;

    const now = performance.now();
    const minHold = tl ? 40 : 70;
    if (next !== lastViseme.current && now - lastSwitch.current > minHold) {
      lastViseme.current = next;
      lastSwitch.current = now;
      applyViseme(next);
    }
    rafRef.current = requestAnimationFrame(loop);
  };

  const endPlayback = () => {
    stopLoop();
    applyViseme(0);
    if (bodyRef.current) bodyRef.current.value = 0;
    setBody(0);
    playingRef.current = null;
    setPlaying(null);
  };

  const playClip = async (id) => {
    if (playing === id) {
      audioRef.current.pause();
      endPlayback();
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.addEventListener('ended', endPlayback);
    }
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AC();
      const src = ctxRef.current.createMediaElementSource(audioRef.current);
      analyserRef.current = ctxRef.current.createAnalyser();
      analyserRef.current.fftSize = 1024;
      analyserRef.current.smoothingTimeConstant = 0.4;
      src.connect(analyserRef.current);
      analyserRef.current.connect(ctxRef.current.destination);
    }
    await ctxRef.current.resume();
    stopLoop();
    audioRef.current.src = `${cfg.audioBase}${id}.mp3`;
    playingRef.current = id;
    setPlaying(id);
    setBody(2);
    try {
      await audioRef.current.play();
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      endPlayback();
    }
  };

  useEffect(() => () => {
    stopLoop();
    if (audioRef.current) audioRef.current.pause();
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
  }, []);

  const bodyLabel = BODY_STATES.find((b) => b.value === body)?.label;
  const visemeLabel = VISEMES.find((v) => v.n === viseme);

  return (
    <>
      {/* ================= HERO — LIVE DEMO ================= */}
      <div className="layout">
        <div className="stage">
          <div className="stage-grid" />
          {switcher}
          <div className="pane show">
            <div className="canvas-wrap">
              <RiveComponent />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="top-tag">
            <span className="pulse" />
            Live State Machine
            <span className="update-pill">Voice character · {cfg.file}</span>
          </div>
          <h1>{cfg.name} Voice Character</h1>
          <p className="sub">
            One artboard, one state machine: body states, eyebrows, look
            direction, blink and 15 mouth visemes, plus audio clips that
            drive the mouth live.
          </p>

          <div className="group-label">
            Audio clips · lip sync
            {!ready && <span className="locked-tag">waiting on .riv</span>}
          </div>
          <div className="audio-list">
            {CLIPS.map((c) => (
              <button
                key={c.id}
                className={`chip-btn ${playing === c.id ? 'on' : ''}`}
                disabled={!ready}
                title={c.text || ''}
                onClick={() => playClip(c.id)}
              >
                <span className="chip-dot" />
                {playing === c.id ? 'Stop' : `Clip ${c.id}`}
                <small>{c.dur.toFixed(1)}s</small>
              </button>
            ))}
          </div>
          <div className="clip-caption">
            {playing
              ? (CLIPS.find((c) => c.id === playing)?.text || `Clip ${playing}`)
              : (CLIPS[0].text ? 'Press a clip: the mouth follows the spoken text.' : 'Press a clip: the mouth follows the audio.')}
          </div>

          <div className="group-label">Body state (BodyState)</div>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {BODY_STATES.map((b) => (
              <button
                key={b.value}
                className={`chip-btn ${body === b.value ? 'on' : ''}`}
                disabled={!bodyIn}
                onClick={() => setBody(b.value)}
              >
                <span className="chip-dot" />{b.label}
              </button>
            ))}
            <button className="chip-btn" disabled={!ackIn} onClick={fireAck}>
              <span className="chip-dot" />Acknowledge
            </button>
            <button className="chip-btn" disabled={!blinkIn} onClick={fireBlink}>
              <span className="chip-dot" />Blink
            </button>
          </div>

          <div className="group-label">Eyebrows ({cfg.eyebrowInput} 0 – 200)</div>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {EYEBROWS.map((e) => (
              <button
                key={e.value}
                className={`chip-btn ${eyebrow === e.value ? 'on' : ''}`}
                disabled={!eyebrowIn}
                onClick={() => setEyebrow(e.value)}
              >
                <span className="chip-dot" />{e.label}
              </button>
            ))}
          </div>
          <div className="card slider-card" style={{ marginBottom: 24 }}>
            <input
              className="range"
              type="range"
              min="0"
              max="200"
              step="1"
              value={eyebrow}
              disabled={!eyebrowIn}
              style={{ '--p': `${(eyebrow / 200) * 100}%` }}
              onChange={(e) => setEyebrow(Number(e.target.value))}
              aria-label={cfg.eyebrowInput}
            />
          </div>

          <div className="group-label">Look direction (LookX / LookY)</div>
          <div className="pad-row">
            <div>
              <div
                ref={padRef}
                className="eye-pad"
                onPointerDown={(e) => {
                  if (!lookXIn) return;
                  dragging.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  moveLook(e);
                }}
                onPointerMove={(e) => dragging.current && moveLook(e)}
                onPointerUp={() => { dragging.current = false; }}
              >
                <div className="eye-pad-cross-h" />
                <div className="eye-pad-cross-v" />
                <div
                  className="eye-pad-dot"
                  style={{ left: `${look.x}%`, top: `${100 - look.y}%` }}
                />
              </div>
              <div className="eye-pad-readout">X {look.x} · Y {look.y}</div>
            </div>
            <div className="pad-side">
              <button className="chip-btn ghost" onClick={() => setLook({ x: 50, y: 50 })} disabled={!lookXIn}>
                <span className="chip-dot" />Center
              </button>
            </div>
          </div>

          <div className="group-label">Mouth visemes (MouthViseme 0 – 14)</div>
          <div className="viseme-grid hero">
            {VISEMES.map((v) => (
              <button
                key={v.n}
                className={`viseme-chip ${viseme === v.n ? 'on' : ''}`}
                disabled={!mouthIn}
                onClick={() => applyViseme(v.n)}
              >
                <span className="viseme-num">{v.n}</span>
                <span className="viseme-name">{v.name}</span>
              </button>
            ))}
          </div>

          <div className="state-readout">
            <span className="live-dot" />
            body: <b>{bodyLabel}</b> · eyebrows: <b>{eyebrow}</b> · mouth: <b>{visemeLabel?.n} {visemeLabel?.name}</b>
          </div>

          <a className="scroll-cue" href="#overview">
            <span>Integration docs</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>

      {/* ================= DOCUMENTATION ================= */}
      <div className="docs">
        <div className="docs-shell">
          <DocsNav />

          <div className="docs-body">
            <DocSection id="overview" eyebrow="Overview" title="One file, one state machine">
              <p>
                {cfg.name} ships as a single <code>.riv</code> file with one state
                machine, <code>{SM}</code>. Every part of the character is
                controlled by a small set of inputs: one number per
                feature, plus two triggers.
              </p>
              <div className="update-grid">
                <div className="update-card system-a">
                  <div className="update-card-title">Body and face</div>
                  <ul>
                    <li><code>BodyState</code> switches Idle, Thinking, Talking</li>
                    <li><code>{cfg.eyebrowInput}</code> blends Neutral, Thinking, Curious</li>
                    <li><code>LookX</code> / <code>LookY</code> move the eyes, 0 to 100</li>
                  </ul>
                </div>
                <div className="update-card">
                  <div className="update-card-title">Voice</div>
                  <ul>
                    <li><code>MouthViseme</code> selects one of 15 mouth shapes</li>
                    <li>{CLIPS.length} audio clips, played with buttons, drive the mouth live</li>
                    <li><code>Blink</code> and <code>Acknowledge</code> are one-shot triggers</li>
                  </ul>
                </div>
              </div>
            </DocSection>

            <DocSection id="body" eyebrow="Body" title="Body states and eyebrows">
              <p>
                <code>BodyState</code> is a number input. The Main layer
                moves between three looping body animations and a one-shot
                reaction.
              </p>
              <table className="stage-table">
                <thead>
                  <tr><th>BodyState</th><th>State</th><th>Animation</th></tr>
                </thead>
                <tbody>
                  {BODY_STATES.map((b) => (
                    <tr key={b.value}><td>{b.value}</td><td>{b.label}</td><td><code>{b.anim}</code></td></tr>
                  ))}
                  <tr><td>trigger</td><td>Acknowledge</td><td><code>ACKNOWLEDGE / REACT</code></td></tr>
                </tbody>
              </table>
              <p>
                <code>Acknowledge</code> plays the reaction once from any
                state and returns to Idle when it finishes.
              </p>
              <h3>Eyebrows</h3>
              <p>
                <code>{cfg.eyebrowInput}</code> runs on its own layer, so the
                eyebrows can change while the body is in any state. It is a
                1D blend, so values between two stops mix the two poses.
              </p>
              <table className="stage-table">
                <thead>
                  <tr><th>{cfg.eyebrowInput}</th><th>Pose</th><th>Animation</th></tr>
                </thead>
                <tbody>
                  {EYEBROWS.map((e) => (
                    <tr key={e.value}><td>{e.value}</td><td>{e.label}</td><td><code>{e.anim}</code></td></tr>
                  ))}
                </tbody>
              </table>
            </DocSection>

            <DocSection id="look" eyebrow="Eyes" title="Look direction and blink">
              <p>
                <code>LookX</code> and <code>LookY</code> are numbers from 0
                to 100 with 50 as the center. Each has its own layer, so the
                eyes move independently of everything else.
              </p>
              <table className="stage-table">
                <thead>
                  <tr><th>Input</th><th>0</th><th>50 (default)</th><th>100</th></tr>
                </thead>
                <tbody>
                  <tr><td><code>LookX</code></td><td><code>Look_Left</code></td><td><code>Look_Center_X</code></td><td><code>Look_Right</code></td></tr>
                  <tr><td><code>LookY</code></td><td><code>Look_Down</code></td><td><code>Look_Center_Y</code></td><td><code>Look_Up</code></td></tr>
                </tbody>
              </table>
              <h3>Blink</h3>
              <p>
                The Blink layer contains an automatic blink loop
                (<code>Blink_Auto</code>). The <code>Blink</code> trigger
                plays one extra blink on demand, for example right after the
                character reacts.
              </p>
              <LiveFeed
                label="Triggers fired from this page"
                text={
                  counts.blink + counts.ack === 0
                    ? 'waiting for first trigger…'
                    : `${counts.blink} blink · ${counts.ack} acknowledge`
                }
              />
            </DocSection>

            <DocSection id="visemes" eyebrow="Voice" title="Mouth visemes">
              <p>
                <code>MouthViseme</code> is a number from 0 to 14. Each value
                shows one mouth shape immediately. It has its own
                layer, so the mouth works in every body state.
              </p>
              <div className="viseme-grid">
                {VISEMES.map((v) => (
                  <div className="viseme-chip" key={v.n}>
                    <span className="viseme-num">{v.n}</span>
                    <span className="viseme-name">{v.name}</span>
                  </div>
                ))}
              </div>
              <table className="stage-table" style={{ marginTop: 22 }}>
                <thead>
                  <tr><th>MouthViseme</th><th>Animation</th></tr>
                </thead>
                <tbody>
                  {VISEMES.map((v) => (
                    <tr key={v.n}><td>{v.n}</td><td><code>{v.anim}</code></td></tr>
                  ))}
                </tbody>
              </table>
            </DocSection>

            <DocSection id="audio" eyebrow="Voice" title="Audio and lip sync">
              <p>
                The {CLIPS.length} clips in <code>/public{cfg.audioBase}</code> play through the
                Web Audio API. While a clip plays, the page reads loudness and
                brightness of the sound every frame, picks a viseme and
                writes it to <code>MouthViseme</code>. It also sets
                <code> BodyState</code> to Talking and returns to Idle when
                the clip ends.
              </p>
              <div className="note-box">
                This demo estimates the mouth shape from the audio signal, so
                it moves in time with the voice but does not know the
                words. For exact lip sync in the app, send the viseme number
                and its timestamp from your speech service
                (text to speech services return these) and write each one
                to <code>MouthViseme</code> at that time.
              </div>
            </DocSection>

            <DocSection id="state-machine" eyebrow="Architecture" title="State machine">
              <div className="tree-block">{`${SM}
  Layer "Main"
    Entry → IDLE
    IDLE ⇄ THINKING              [BodyState = 1]
    IDLE ⇄ RESPONDING / TALKING  [BodyState = 2]
    Any State → ACKNOWLEDGE / REACT  [Acknowledge trigger]
    ACKNOWLEDGE / REACT → IDLE   (when finished)
  Layer "${cfg.visemeLayer}"
    15 states, Viseme_00 … Viseme_14   [MouthViseme = 0 … 14]
  Layer "Eyebrows"
    1D blend on ${cfg.eyebrowInput}
    0 Neutral · 100 Thinking · 200 Curious
  Layer "LookX"   1D blend on LookX   0 Left · 50 Center · 100 Right
  Layer "LookY"   1D blend on LookY   0 Down · 50 Center · 100 Up
  Layer "Blink"
    Blink_Auto loop, Blink [Trigger] → plays Blink once`}</div>
            </DocSection>

            <DocSection id="inputs" eyebrow="Reference" title="Input reference">
              <div className="inputs-grid">
                <InputCard kind="Number" name="BodyState" desc="0 Idle, 1 Thinking, 2 Talking." />
                <InputCard kind="Number" name={cfg.eyebrowInput} desc="0 to 200. Blends Neutral, Thinking, Curious." />
                <InputCard kind="Number" name="LookX" desc="0 to 100, default 50. Left to right." />
                <InputCard kind="Number" name="LookY" desc="0 to 100, default 50. Down to up." />
                <InputCard kind="Number" name="MouthViseme" desc="0 to 14. Selects the mouth shape." />
                <InputCard kind="Trigger" name="Acknowledge" desc="Plays the reaction once." />
                <InputCard kind="Trigger" name="Blink" desc="Plays one blink, then resets." />
              </div>
            </DocSection>

            <DocSection id="js" eyebrow="JavaScript" title="Web integration example">
              <CodeBlock code={jsExample(cfg)} />
            </DocSection>

            <DocSection id="rn" eyebrow="React Native" title="React Native example">
              <CodeBlock code={rnExample(cfg)} />
            </DocSection>

            <DocSection id="files" eyebrow="Files" title="Where the files live">
              <p>
                The <code>.riv</code> files live in a private Supabase Storage
                bucket (<code>rive-assets</code>) and are served by the app
                through <code>/api/rive?c=ms_i</code> and{' '}
                <code>/api/rive?c=mr_q</code>, so they can be replaced without
                redeploying. The audio clips are static assets in{' '}
                <code>/public</code>.
              </p>
              <div className="tree-block">{`Supabase Storage / rive-assets /
  ms_i.riv          state machine "Ms I Controller"
  mr_q.riv          state machine "Mr Q Controller"

public/
  audio/
    02.mp3 … 10.mp3        Ms I voice clips
    mrq/01.mp3 … 12.mp3    Mr Q voice clips`}</div>
            </DocSection>

            <DocSection id="checklist" eyebrow="Integration Checklist" title="Ship it">
              <ul className="check-list boxes">
                <li>Load <code>{cfg.file}</code> with state machine <code>{SM}</code></li>
                <li>Write <code>BodyState</code> (0, 1, 2) and <code>{cfg.eyebrowInput}</code> (0 to 200)</li>
                <li>Bind pointer or gaze to <code>LookX</code> / <code>LookY</code> (0 to 100)</li>
                <li>Fire <code>Acknowledge</code> and <code>Blink</code> when needed</li>
                <li>Write the current viseme (0 to 14) to <code>MouthViseme</code> while audio plays</li>
                <li>Done</li>
              </ul>
            </DocSection>

            <footer className="docs-footer">
              {cfg.name} Voice Character · Rive integration docs
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}

function DocsNav() {
  const items = [
    ['overview', 'Overview'],
    ['body', 'Body & Eyebrows'],
    ['look', 'Look & Blink'],
    ['visemes', 'Mouth Visemes'],
    ['audio', 'Audio & Lip Sync'],
    ['state-machine', 'State Machine'],
    ['inputs', 'Inputs'],
    ['js', 'JavaScript'],
    ['rn', 'React Native'],
    ['files', 'Files'],
    ['checklist', 'Checklist'],
  ];
  return (
    <nav className="docs-nav">
      <div className="docs-nav-label">Contents</div>
      {items.map(([id, label]) => (
        <a key={id} href={`#${id}`}>{label}</a>
      ))}
    </nav>
  );
}

function DocSection({ id, eyebrow, title, children }) {
  return (
    <section id={id} className="doc-section">
      <div className="doc-eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function InputCard({ kind, name, desc }) {
  return (
    <div className="input-card">
      <div className="input-kind">{kind}</div>
      <code>{name}</code>
      <p>{desc}</p>
    </div>
  );
}

function LiveFeed({ label, text }) {
  return (
    <div className="live-feed">
      <span className="live-feed-dot" />
      <span className="live-feed-label">{label}</span>
      <span className="live-feed-value">{text}</span>
    </div>
  );
}

function CodeBlock({ code }) {
  return <pre className="code-block"><code>{code}</code></pre>;
}

const jsExample = (cfg) => `import { Rive, Fit, Alignment, Layout } from '@rive-app/canvas'

const SM = '${cfg.sm}'

const character = new Rive({
  src: '/${cfg.file}',
  canvas: document.getElementById('canvas'),
  stateMachines: SM,
  autoplay: true,
  layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  onLoad: () => {
    const inputs = character.stateMachineInputs(SM)
    const get = (name) => inputs.find((i) => i.name === name)

    get('BodyState').value = 0        // 0 Idle, 1 Thinking, 2 Talking
    get('${cfg.eyebrowInput}').value = 0     // 0 Neutral, 100 Thinking, 200 Curious
    get('LookX').value = 50           // 0 left, 50 center, 100 right
    get('LookY').value = 50           // 0 down, 50 center, 100 up

    get('Acknowledge').fire()
    get('Blink').fire()

    // while audio plays: write the viseme number (0 to 14)
    get('MouthViseme').value = 3
  },
})`;

const rnExample = (cfg) => `import Rive from 'rive-react-native'

const SM = '${cfg.sm}'

export function ${cfg.name.replace(' ', '')}({ body, eyebrow, viseme }) {
  const riveRef = useRef(null)

  useEffect(() => {
    riveRef.current?.setInputState(SM, 'BodyState', body)
  }, [body])

  useEffect(() => {
    riveRef.current?.setInputState(SM, '${cfg.eyebrowInput}', eyebrow)
  }, [eyebrow])

  useEffect(() => {
    riveRef.current?.setInputState(SM, 'MouthViseme', viseme)   // 0 to 14
  }, [viseme])

  return (
    <Rive
      ref={riveRef}
      resourceName="${cfg.file.replace('.riv', '')}"
      stateMachineName={SM}
      autoplay
      style={{ width: '100%', height: 420 }}
    />
  )
}

// triggers
// riveRef.current?.fireState(SM, 'Acknowledge')
// riveRef.current?.fireState(SM, 'Blink')`;