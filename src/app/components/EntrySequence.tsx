"use client";

import { useEffect, useRef, useState } from "react";
import { Cinzel } from "next/font/google";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500", "700"] });

// ---- Timing constants (ms) --------------------------------------------------
const FADE = 1000; // standard cross-fade / reveal duration
const LOADING_MIN = 1500; // minimum time the loading screen stays visible
const LOADING_SETTLE = 500; // pause after progress hits 1 before leaving loading
const CTX_LABEL_IN = 1200; // "Northeast Brazil, 1877" fade-in
const CTX_AFTER_LABEL = 1000; // wait after label before paragraph
const CTX_PARA_IN = 1200; // paragraph fade-in
const CTX_AFTER_PARA = 1500; // wait after paragraph before Begin button
const AUDIO_VOLUME = 0.4;
const AUDIO_FADE_IN = 1500;

type Phase = "loading" | "title" | "context" | "done";

export function EntrySequence({
  progress,
  onComplete,
}: {
  progress: number;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  // Controls opacity of the inner content (drives loading<->title cross-fade).
  const [contentVisible, setContentVisible] = useState(false);
  // Controls opacity of the outer black overlay (final reveal).
  const [overlayVisible, setOverlayVisible] = useState(true);
  // When true, the three context elements fade out together.
  const [contextExiting, setContextExiting] = useState(false);

  const mountTime = useRef(Date.now());

  // --- Audio (Web Audio API for smooth volume control) ---------------------
  const audioRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    source: AudioBufferSourceNode;
  } | null>(null);

  const startAudio = async () => {
    if (audioRef.current) return;
    try {
      const ctx = new AudioContext();
      const res = await fetch("/sounds/noise.wav");
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(
        AUDIO_VOLUME,
        ctx.currentTime + AUDIO_FADE_IN / 1000
      );
      source.connect(gain).connect(ctx.destination);
      source.start();
      audioRef.current = { ctx, gain, source };
    } catch {
      // Autoplay/decoding blocked — fail silently, the visuals still work.
    }
  };

  const fadeOutAudio = (durationMs: number) => {
    const a = audioRef.current;
    if (!a) return;
    const end = a.ctx.currentTime + durationMs / 1000;
    a.gain.gain.cancelScheduledValues(a.ctx.currentTime);
    a.gain.gain.setValueAtTime(a.gain.gain.value, a.ctx.currentTime);
    a.gain.gain.linearRampToValueAtTime(0.0001, end);
    window.setTimeout(() => {
      try {
        a.source.stop();
        a.ctx.close();
      } catch {
        /* noop */
      }
    }, durationMs + 50);
  };

  // Cross-fade helper: fade current content out, swap phase, fade new in.
  const transitionTo = (next: Phase) => {
    setContentVisible(false);
    window.setTimeout(() => {
      setPhase(next);
      // next frame so the browser registers opacity:0 before transitioning up
      requestAnimationFrame(() => requestAnimationFrame(() => setContentVisible(true)));
    }, FADE);
  };

  // Initial fade-in of the loading screen.
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setContentVisible(true)));
  }, []);

  // Loading -> Title once assets are ready (respecting the minimum display time).
  useEffect(() => {
    if (phase !== "loading" || progress < 1) return;
    const elapsed = Date.now() - mountTime.current;
    const wait = Math.max(LOADING_MIN - elapsed, 0) + LOADING_SETTLE;
    const t = window.setTimeout(() => transitionTo("title"), wait);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, progress]);

  const handleEnter = () => {
    // First user gesture — start the ambient audio here.
    void startAudio();
    transitionTo("context");
  };

  const handleBegin = () => {
    // Request pointer lock inside the click handler while we still hold
    // transient user activation, so it doesn't get rejected after the fade.
    document.querySelector("canvas")?.requestPointerLock?.();

    // 1) Fade the three context elements out together.
    setContextExiting(true);
    // 2) Fade the black overlay away + fade the audio out.
    window.setTimeout(() => {
      setOverlayVisible(false);
      fadeOutAudio(FADE);
    }, FADE);
    // 3) Reveal complete — hand control to the parent and unmount.
    window.setTimeout(() => {
      setPhase("done");
      onComplete();
    }, FADE * 2);
  };

  if (phase === "done") return null;

  return (
    <div
      className={cinzel.className}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "black",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        opacity: overlayVisible ? 1 : 0,
        transition: `opacity ${FADE}ms ease`,
        pointerEvents: overlayVisible ? "auto" : "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          opacity: contentVisible ? 1 : 0,
          transition: `opacity ${FADE}ms ease`,
        }}
      >
        {phase === "loading" && <LoadingScreen progress={progress} />}
        {phase === "title" && <TitleScreen onEnter={handleEnter} />}
        {phase === "context" && (
          <ContextScreen exiting={contextExiting} onBegin={handleBegin} />
        )}
      </div>
    </div>
  );
}

// ---- State 1: Loading -------------------------------------------------------
function LoadingScreen({ progress }: { progress: number }) {
  const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 400, letterSpacing: "0.15em" }}>
        Loading
      </div>
      <div
        style={{
          marginTop: "1.5rem",
          width: 200,
          height: 6,
          border: "1px solid white",
          borderRadius: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "white",
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}

// ---- State 2: Title ---------------------------------------------------------
function TitleScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <h1
        style={{
          fontSize: "clamp(4.2rem, 12.6vw, 8.4rem)",
          fontWeight: 400,
          letterSpacing: "0.08em",
          margin: 0,
        }}
      >
        Caatinga
      </h1>
      <button
        onClick={onEnter}
        style={{ ...underlinedButton, fontSize: "1.54rem", marginTop: "2.5rem" }}
      >
        Enter
      </button>
    </div>
  );
}

// ---- State 3: Context -------------------------------------------------------
function ContextScreen({
  exiting,
  onBegin,
}: {
  exiting: boolean;
  onBegin: () => void;
}) {
  const [labelIn, setLabelIn] = useState(false);
  const [paraIn, setParaIn] = useState(false);
  const [buttonIn, setButtonIn] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    // Label fades in first.
    timers.push(window.setTimeout(() => setLabelIn(true), 100));
    // Then the paragraph, after the label finishes + a beat.
    timers.push(
      window.setTimeout(() => setParaIn(true), 100 + CTX_LABEL_IN + CTX_AFTER_LABEL)
    );
    // Then the Begin button.
    timers.push(
      window.setTimeout(
        () => setButtonIn(true),
        100 + CTX_LABEL_IN + CTX_AFTER_LABEL + CTX_PARA_IN + CTX_AFTER_PARA
      )
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const fadeStyle = (visible: boolean, duration: number): React.CSSProperties => ({
    opacity: exiting ? 0 : visible ? 1 : 0,
    transition: `opacity ${exiting ? FADE : duration}ms ease`,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2.5rem",
      }}
    >
      <div
        style={{
          fontSize: "0.95rem",
          fontWeight: 400,
          letterSpacing: "0.2em",
          opacity: 0.75,
          ...fadeStyle(labelIn, CTX_LABEL_IN),
        }}
      >
        Northeast Brazil, 1877
      </div>

      <p
        style={{
          maxWidth: 480,
          margin: 0,
          fontSize: "1.15rem",
          fontWeight: 400,
          lineHeight: 1.9,
          ...fadeStyle(paraIn, CTX_PARA_IN),
        }}
      >
        The Great Drought of 1877 devastated the Brazilian sertão. Hundreds of
        thousands died. Millions left. This is what remained.
      </p>

      <button
        onClick={onBegin}
        disabled={!buttonIn || exiting}
        style={{ ...underlinedButton, ...fadeStyle(buttonIn, FADE) }}
      >
        Begin
      </button>
    </div>
  );
}

// Plain-text underlined button — no border, no background, no padding box.
const underlinedButton: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "white",
  font: "inherit",
  fontSize: "1.1rem",
  letterSpacing: "0.1em",
  textDecoration: "underline",
  textUnderlineOffset: "0.35em",
  cursor: "pointer",
};
