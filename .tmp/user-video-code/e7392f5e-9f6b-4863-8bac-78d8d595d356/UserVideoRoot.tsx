import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Img,
  Easing,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

/**
 * ELITE REMOTION ARCHITECTURE: AI NEWS PIPELINE
 * Asset: Anthropic Tool Leak Analysis
 * Theme: Modern Editorial / Light High-End Brand
 */

// 1. Font & Asset Configuration
const { fontFamily } = loadFont('normal', {
  weights: ['400', '600', '800'],
});

const LOGO_URL = "https://img.logo.dev/claudeai.com?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128&retina=false&format=png&theme=dark";

// 2. Constants & Palette
const COLORS = {
  background: '#FDFBF7', // Off-white cream
  text: '#2D2D2D',       // Dark charcoal
  accentPrimary: '#A8DADC', // Soft sky blue
  accentSecondary: '#E5989B', // Dusty rose
  danger: '#D62828',
};

// 3. Components

const GrainOverlay: React.FC = () => (
  <div style={{
    position: 'absolute',
    inset: 0,
    opacity: 0.03,
    pointerEvents: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
  }} />
);

const Card: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 100 }
  });

  return (
    <div style={{
      opacity: entrance,
      transform: `translateY(${interpolate(entrance, [0, 1], [40, 0])}px) scale(${interpolate(entrance, [0, 1], [0.95, 1])})`,
      backgroundColor: 'white',
      borderRadius: '24px',
      padding: '40px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
      border: `1px solid rgba(0,0,0,0.03)`,
      width: '85%',
    }}>
      {children}
    </div>
  );
};

const KineticText: React.FC<{ text: string; delay?: number; mode: 'word' | 'char' | 'fade' }> = ({ text, delay = 0, mode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = mode === 'word' ? text.split(' ') : mode === 'char' ? text.split('') : [text];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: mode === 'word' ? '0.25em' : '0.02em' }}>
      {items.map((item, i) => {
        const itemDelay = delay + (i * (mode === 'char' ? 1 : 3));
        const progress = spring({
          frame: frame - itemDelay,
          fps,
          config: { damping: 15, stiffness: 150 }
        });

        return (
          <span key={i} style={{
            display: 'inline-block',
            opacity: progress,
            transform: mode === 'fade' ? 'none' : `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`,
            whiteSpace: item === ' ' ? 'pre' : 'normal'
          }}>
            {item}
          </span>
        );
      })}
    </div>
  );
};

// 4. Main Composition
export const AnthropicNewsVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Root layout wrapper - ensuring safety zones
  const ContainerStyle: React.CSSProperties = {
    backgroundColor: COLORS.background,
    width: '100%',
    height: '100%',
    fontFamily,
    color: COLORS.text,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'hidden',
  };

  return (
    <AbsoluteFill style={ContainerStyle}>
      <GrainOverlay />

      {/* SCENE 1: Brand Announcement (0.2s - 7.5s) 
          Constraint: Top-weighted for Avatar safety in bottom half */}
      <Sequence from={Math.floor(0.2 * fps)} durationInFrames={Math.floor((7.5 - 0.2) * fps)}>
        <div style={{ width: '100%', height: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '30px', paddingBottom: '40px' }}>
          <Img src={LOGO_URL} style={{ width: '100px', borderRadius: '25px', transform: `scale(${spring({ frame: frame - 10, fps })})` }} />
          <div style={{ width: '85%', textAlign: 'center' }}>
            <h1 style={{ fontSize: '72px', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
              <KineticText text="Anthropic Tool Leak" mode="char" delay={15} />
            </h1>
            <p style={{ fontSize: '32px', color: COLORS.accentSecondary, fontWeight: 600, marginTop: '20px' }}>
              <KineticText text="Source code posted publicly" mode="fade" delay={45} />
            </p>
          </div>
        </div>
        {/* Visual Metaphor: Data flowing (Top weighted) */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '10%', background: `linear-gradient(to bottom, ${COLORS.accentPrimary}22, transparent)` }} />
      </Sequence>

      {/* SCENE 2: The Malicious Pivot (7.5s - 16.8s) */}
      <Sequence from={Math.floor(7.5 * fps)} durationInFrames={Math.floor((16.8 - 7.5) * fps)}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLORS.danger }} />
              <span style={{ fontWeight: 800, letterSpacing: '0.1em', fontSize: '24px', color: COLORS.danger }}>MALWARE DETECTED</span>
            </div>
            <h2 style={{ fontSize: '56px', fontWeight: 800, margin: 0 }}>
              <KineticText text="Poisoned Repositories" mode="word" delay={10} />
            </h2>
            <p style={{ fontSize: '32px', marginTop: '20px', lineHeight: 1.4 }}>
              Hackers added info-stealing scripts to Claude AI tool forks.
            </p>
          </Card>
          {/* GitHub UI Simulation */}
          <div style={{ marginTop: '40px', width: '80%', opacity: 0.4 }}>
             <div style={{ height: '4px', background: '#eee', borderRadius: '2px', width: '100%', marginBottom: '10px' }} />
             <div style={{ height: '4px', background: '#eee', borderRadius: '2px', width: '60%' }} />
          </div>
        </div>
      </Sequence>

      {/* SCENE 3: Whack-a-Mole (16.8s - 23.1s) */}
      <Sequence from={Math.floor(16.8 * fps)} durationInFrames={Math.floor((23.1 - 16.8) * fps)}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: '120px', fontWeight: 800, margin: 0, color: COLORS.accentSecondary }}>
            {Math.floor(interpolate(frame % 30, [0, 15], [0, 96], { extrapolateRight: 'clamp' }))}
          </h2>
          <div style={{ fontSize: '48px', fontWeight: 600 }}>GitHub Repos Taken Down</div>
          <div style={{ marginTop: '50px', width: '85%', height: '300px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} style={{ 
                width: '30px', height: '30px', background: COLORS.accentPrimary, 
                opacity: Math.sin(frame * 0.1 + i) > 0 ? 0.8 : 0.1,
                transform: `scale(${Math.sin(frame * 0.2 + i)})`,
                borderRadius: '4px'
              }} />
            ))}
          </div>
        </div>
      </Sequence>

      {/* SCENE 4: Pattern Recognition (23.1s - 29.5s) */}
      <Sequence from={Math.floor(23.1 * fps)} durationInFrames={Math.floor((29.5 - 23.1) * fps)}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', padding: '0 40px' }}>
            <div style={{ background: COLORS.accentPrimary, padding: '10px 20px', display: 'inline-block', borderRadius: '10px', marginBottom: '20px', fontWeight: 800 }}>ALERT</div>
            <h2 style={{ fontSize: '64px', fontWeight: 800 }}>3rd Cloud Code Hijack in 6 Months</h2>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '40px' }}>
              {['Google Ads', 'Poisoned Source', 'Fake Packages'].map((t, i) => (
                <div key={i} style={{ border: `2px solid ${COLORS.text}33`, padding: '15px', borderRadius: '15px', fontSize: '24px' }}>{t}</div>
              ))}
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SCENE 5: Attack Vector Flow (29.5s - 35.0s) */}
      <Sequence from={Math.floor(29.5 * fps)} durationInFrames={Math.floor((35.0 - 29.5) * fps)}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '80%', height: '400px' }}>
             {/* Simple Flow Diagram */}
             <div style={{ position: 'absolute', top: '10%', left: '10%', width: '150px', height: '100px', border: '3px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', fontWeight: 800 }}>DEV TOOL</div>
             <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '150px', height: '100px', background: COLORS.danger, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', fontWeight: 800 }}>USER DATA</div>
             {/* Arrow line */}
             <div style={{ 
               position: 'absolute', top: '50%', left: '20%', right: '20%', height: '2px', background: COLORS.text,
               transformOrigin: 'left',
               scaleX: spring({ frame: frame - (29.5 * fps), fps })
             }} />
             <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)', background: 'white', border: '1px solid black', padding: '10px 20px', borderRadius: '20px' }}>ATTACK VECTOR</div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SCENE 6 & 7: Industry Critique (35.0s - 46.4s) */}
      <Sequence from={Math.floor(35.0 * fps)} durationInFrames={Math.floor((46.4 - 35.0) * fps)}>
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: '85%', borderLeft: `8px solid ${COLORS.accentSecondary}`, paddingLeft: '40px' }}>
            <h2 style={{ fontSize: '82px', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>Ship Now.</h2>
            <h2 style={{ fontSize: '82px', fontWeight: 800, margin: 0, textTransform: 'uppercase', color: `${COLORS.text}44` }}>Secure Later?</h2>
            <p style={{ fontSize: '42px', marginTop: '40px', maxWidth: '600px', lineHeight: 1.2 }}>
              Industry is racing to release features, often leaving security as an afterthought.
            </p>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SCENE 8: Vulnerability Warning (46.4s - 51.7s) */}
      <Sequence from={Math.floor(46.4 * fps)} durationInFrames={Math.floor((51.7 - 46.4) * fps)}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.danger }}>
          <div style={{ color: 'white', textAlign: 'center', padding: '40px' }}>
            <h2 style={{ fontSize: '72px', fontWeight: 800, marginBottom: '20px' }}>WHAT ELSE IS VULNERABLE?</h2>
            <div style={{ width: '100%', height: '2px', background: 'white', margin: '30px 0' }} />
            <p style={{ fontSize: '38px', opacity: 0.9 }}>Next major model launch could carry the next backdoor.</p>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SCENE 9: Outro (51.7s - 56.3s) */}
      <Sequence from={Math.floor(51.7 * fps)} durationInFrames={Math.floor((56.32 - 51.7) * fps)}>
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '24px', letterSpacing: '0.2em', fontWeight: 600 }}>SYSTEM STATUS</div>
              <h1 style={{ fontSize: '82px', fontWeight: 800, color: COLORS.accentPrimary }}>STAY VIGILANT</h1>
              <div style={{ width: '100px', height: '4px', background: COLORS.text }} />
              <p style={{ fontSize: '36px', marginTop: '20px' }}>See you in the terminal.</p>
            </div>
          </Card>
          <div style={{ marginTop: '50px', display: 'flex', gap: '20px' }}>
            <div style={{ width: '40px', height: '4px', background: COLORS.accentSecondary }} />
            <div style={{ width: '40px', height: '4px', background: COLORS.accentPrimary }} />
            <div style={{ width: '40px', height: '4px', background: COLORS.text }} />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Global Progress Bar (Top) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '8px',
        backgroundColor: COLORS.accentPrimary,
        width: `${(frame / (56.3 * fps)) * 100}%`
      }} />
    </AbsoluteFill>
  );
};