'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadStudioTtsAudio } from '../lib/studioAudioCache';
import { buildAssetBrief, type AssetBriefItem } from '../lib/videoPlan/directorPrompt';
import type { TimingWord, VideoPlan } from '../lib/videoPlan/types';

interface VideoTabProps {
  script: string | null;
  audioUrl: string | null;
  audioServerPath?: string | null;
  initialTimings?: TimingWord[] | null;
  onTimingsExtracted?: (timings: TimingWord[]) => void;
}

type PipelineStage =
  | 'idle'
  | 'analyzing'
  | 'planning'
  | 'briefing'
  | 'prompting'
  | 'uploading_video'
  | 'uploading_music'
  | 'muxing'
  | 'ready';

function summarizeAsset(item: AssetBriefItem) {
  return `${item.kind.toUpperCase()} // ${item.query}`;
}

export default function VideoTab({
  script,
  audioUrl,
  audioServerPath = null,
  initialTimings = null,
  onTimingsExtracted,
}: VideoTabProps) {
  const [timings, setTimings] = useState<TimingWord[] | null>(initialTimings);
  const [videoPlan, setVideoPlan] = useState<VideoPlan | null>(null);
  const [assetBrief, setAssetBrief] = useState<AssetBriefItem[]>([]);
  const [directorPrompt, setDirectorPrompt] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedVideoName, setUploadedVideoName] = useState<string | null>(null);
  const [musicTrackUrl, setMusicTrackUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialTimings) setTimings(initialTimings);
  }, [initialTimings]);

  const selectedScene = useMemo(
    () => videoPlan?.scenes.find((scene) => scene.sceneId === selectedSceneId) || videoPlan?.scenes[0] || null,
    [selectedSceneId, videoPlan],
  );

  async function handleAnalyzeAudio() {
    if (!audioUrl) return;
    setStage('analyzing');
    setErrorMsg('');

    try {
      let audioBlob: Blob | null = null;
      try {
        const blobRes = await fetch(audioUrl);
        if (!blobRes.ok) {
          throw new Error(`AUDIO_FETCH_FAILED // HTTP ${blobRes.status}`);
        }
        audioBlob = await blobRes.blob();
      } catch {
        audioBlob = await loadStudioTtsAudio();
      }

      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('AUDIO_BLOB_UNAVAILABLE');
      }

      const file = new File([audioBlob], 'tts_audio.wav', { type: 'audio/wav' });
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/timeline', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        throw new Error(`Timeline extraction failed: HTTP ${res.status}`);
      }

      const data = await res.json();
      const extractedTimings = data.timings || data;
      setTimings(extractedTimings);
      if (Array.isArray(extractedTimings)) onTimingsExtracted?.(extractedTimings);
      setStage('idle');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'TIMELINE_SYNC_FAILED';
      setErrorMsg(message);
      setStage('idle');
    }
  }

  async function handlePlanVideo() {
    if (!script || !timings) return;
    setStage('planning');
    setErrorMsg('');

    try {
      const res = await fetch('/api/director/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, timings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `PLAN_FAILED // HTTP ${res.status}`);

      setVideoPlan(data.videoPlan);
      setSelectedSceneId(data.videoPlan?.scenes?.[0]?.sceneId || null);
      setAssetBrief([]);
      setDirectorPrompt('');
      setUploadedVideoUrl(null);
      setUploadedVideoName(null);
      setMusicTrackUrl(null);
      setDownloadUrl(null);
      setStage('idle');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PLAN_FAILED';
      setErrorMsg(message);
      setStage('idle');
    }
  }

  function handleBuildAssetBrief() {
    if (!videoPlan) return;
    setStage('briefing');
    setErrorMsg('');
    setAssetBrief(buildAssetBrief(videoPlan));
    setStage('idle');
  }

  async function handleGenerateDirectorPrompt() {
    if (!videoPlan || !script || !timings) return;
    setStage('prompting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/director/director-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, timings, videoPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `DIRECTOR_PROMPT_FAILED // HTTP ${res.status}`);
      setAssetBrief(data.assetBrief || []);
      setDirectorPrompt(data.directorPrompt || '');
      setStage('ready');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'DIRECTOR_PROMPT_FAILED';
      setErrorMsg(message);
      setStage('idle');
    }
  }

  async function handleUploadVideo(file: File | null) {
    if (!file) return;
    setStage('uploading_video');
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/director/upload-final-video', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `UPLOAD_VIDEO_FAILED // HTTP ${res.status}`);

      setUploadedVideoUrl(data.url);
      setUploadedVideoName(data.filename || file.name);
      setDownloadUrl(null);
      setStage('ready');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'UPLOAD_VIDEO_FAILED';
      setErrorMsg(message);
      setStage('idle');
    }
  }

  async function handleUploadMusic(file: File | null) {
    if (!file) return;
    setStage('uploading_music');
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/director/upload-music', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `UPLOAD_MUSIC_FAILED // HTTP ${res.status}`);

      setMusicTrackUrl(data.url);
      setStage('ready');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'UPLOAD_MUSIC_FAILED';
      setErrorMsg(message);
      setStage('idle');
    }
  }

  async function handleMuxAudio() {
    if (!uploadedVideoUrl || !audioServerPath) return;
    setStage('muxing');
    setErrorMsg('');

    try {
      const res = await fetch('/api/director/mux-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadedVideoUrl,
          audioTrackUrl: audioServerPath,
          musicTrackUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `MUX_AUDIO_FAILED // HTTP ${res.status}`);
      setDownloadUrl(data.downloadUrl || null);
      setStage('ready');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'MUX_AUDIO_FAILED';
      setErrorMsg(message);
      setStage('ready');
    }
  }

  async function handleCopyPrompt() {
    if (!directorPrompt) return;
    await navigator.clipboard.writeText(directorPrompt);
  }

  if (!script || !audioUrl) {
    return (
      <div className="state-container">
        <p style={{ color: 'var(--text-dim)' }}>
          NO DATA STREAMS LOADED. COMPLETE SCRIPT_GEN AND TTS_VOICE FIRST.
        </p>
      </div>
    );
  }

  return (
    <div className="video-pipeline-shell">
      <div className="ticker-banner" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className={`stat-block ${timings ? 'outline' : ''}`}>
          <span className="label">1. TIMINGS</span>
          <button className="sys-btn" onClick={handleAnalyzeAudio} disabled={stage === 'analyzing'}>
            {stage === 'analyzing' ? '[ EXTRACTING... ]' : timings ? '[ READY ]' : '[ EXTRACT ]'}
          </button>
        </div>
        <div className={`stat-block ${videoPlan ? 'outline' : ''}`}>
          <span className="label">2. VIDEO_PLAN</span>
          <button className="sys-btn" onClick={handlePlanVideo} disabled={!timings || stage === 'planning'}>
            {stage === 'planning' ? '[ PLANNING... ]' : videoPlan ? '[ READY ]' : '[ PLAN ]'}
          </button>
        </div>
        <div className={`stat-block ${assetBrief.length > 0 ? 'outline' : ''}`}>
          <span className="label">3. ASSET_BRIEF</span>
          <button className="sys-btn" onClick={handleBuildAssetBrief} disabled={!videoPlan || stage === 'briefing'}>
            {stage === 'briefing' ? '[ BUILDING... ]' : assetBrief.length > 0 ? '[ READY ]' : '[ BUILD ]'}
          </button>
        </div>
        <div className={`stat-block ${directorPrompt ? 'outline' : ''}`}>
          <span className="label">4. DIRECTOR_PROMPT</span>
          <button className="sys-btn" onClick={handleGenerateDirectorPrompt} disabled={!videoPlan || stage === 'prompting'}>
            {stage === 'prompting' ? '[ GENERATING... ]' : directorPrompt ? '[ READY ]' : '[ GENERATE ]'}
          </button>
        </div>
        <div className={`stat-block ${uploadedVideoUrl ? 'outline' : ''}`}>
          <span className="label">5. UPLOAD_VIDEO</span>
          <span className="value" style={{ fontSize: '1rem' }}>
            {uploadedVideoUrl ? 'READY' : 'EMPTY'}
          </span>
        </div>
        <div className={`stat-block ${downloadUrl || stage === 'muxing' ? 'outline' : ''}`}>
          <span className="label">6. MUX_AUDIO</span>
          {downloadUrl ? (
            <a className="sys-btn" href={downloadUrl} download>
              [ DOWNLOAD_MP4 ]
            </a>
          ) : (
            <button className="sys-btn" onClick={handleMuxAudio} disabled={!uploadedVideoUrl || !audioServerPath || stage === 'muxing'}>
              {stage === 'muxing' ? '[ MUXING... ]' : '[ MUX ]'}
            </button>
          )}
        </div>
      </div>

      {errorMsg ? (
        <div className="state-container error" style={{ borderColor: 'var(--brand-alert)' }}>
          <h3 style={{ color: 'var(--brand-alert)' }}>[ RENDER_MATRIX_ERROR ]</h3>
          <p>{errorMsg}</p>
        </div>
      ) : null}

      <div className="video-stage-grid">
        <div className="video-scene-rail">
          <div className="video-rail-header">
            <span className="label">SCENE PLAN</span>
            <span className="value">{videoPlan?.scenes.length || 0} scenes</span>
          </div>
          <div className="video-scene-list">
            {(videoPlan?.scenes || []).map((scene) => (
              <button
                key={scene.sceneId}
                type="button"
                className={`scene-chip ${selectedScene?.sceneId === scene.sceneId ? 'active' : ''}`}
                onClick={() => setSelectedSceneId(scene.sceneId)}
              >
                <span>{scene.sceneId.toUpperCase()}</span>
                <strong>{scene.template.replaceAll('_', ' ')}</strong>
                <small>
                  {scene.startSec.toFixed(1)}s - {scene.endSec.toFixed(1)}s
                </small>
              </button>
            ))}
            {!videoPlan ? (
              <div className="state-container" style={{ padding: '24px 16px' }}>
                <p style={{ color: 'var(--text-dim)' }}>PLAN THE VIDEO TO INSPECT THE SHOT BREAKDOWN.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="video-preview-column">
          <div className="modal-box" style={{ width: '100%', maxWidth: '100%', boxShadow: 'none' }}>
            <div className="modal-header">
              <span className="modal-title">FINAL_VIDEO_INPUT</span>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{stage.toUpperCase()}</span>
            </div>
            <div className="scene-detail-body">
              <div className="scene-meta-grid">
                <div>
                  <span className="label">VIDEO_UPLOAD</span>
                  <label className="sys-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {stage === 'uploading_video' ? '[ UPLOADING... ]' : uploadedVideoUrl ? '[ REPLACE_VIDEO ]' : '[ UPLOAD_VIDEO ]'}
                    <input
                      type="file"
                      accept="video/*"
                      style={{ display: 'none' }}
                      disabled={stage === 'uploading_video'}
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0] || null;
                        void handleUploadVideo(nextFile);
                      }}
                    />
                  </label>
                </div>
                <div>
                  <span className="label">MUSIC</span>
                  <label className="sys-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {stage === 'uploading_music' ? '[ UPLOADING... ]' : musicTrackUrl ? '[ REPLACE_MUSIC ]' : '[ OPTIONAL_MUSIC ]'}
                    <input
                      type="file"
                      accept="audio/*"
                      style={{ display: 'none' }}
                      disabled={stage === 'uploading_music'}
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0] || null;
                        void handleUploadMusic(nextFile);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="state-container" style={{ minHeight: '220px', alignItems: 'flex-start', textAlign: 'left' }}>
                <p style={{ color: 'var(--text-core)', marginBottom: '12px' }}>
                  Upload the full silent video for this script. The app will keep your visual edit intact and only add the TTS voice plus optional music.
                </p>
                <div className="scene-meta-grid" style={{ width: '100%' }}>
                  <div>
                    <span className="label">VIDEO</span>
                    <strong>{uploadedVideoName || 'NOT_UPLOADED'}</strong>
                  </div>
                  <div>
                    <span className="label">VOICE_TRACK</span>
                    <strong>{audioServerPath ? 'READY' : 'MISSING'}</strong>
                  </div>
                  <div>
                    <span className="label">MUSIC_TRACK</span>
                    <strong>{musicTrackUrl ? 'READY' : 'NONE'}</strong>
                  </div>
                  <div>
                    <span className="label">OUTPUT</span>
                    <strong>{downloadUrl ? 'READY' : 'PENDING'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-box" style={{ width: '100%', maxWidth: '100%', boxShadow: 'none' }}>
            <div className="modal-header">
              <span className="modal-title">DIRECTOR_PROMPT</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="sys-btn" onClick={() => void handleCopyPrompt()} disabled={!directorPrompt}>
                  [ COPY ]
                </button>
              </div>
            </div>
            <div className="scene-detail-body">
              {directorPrompt ? (
                <textarea
                  readOnly
                  value={directorPrompt}
                  style={{
                    width: '100%',
                    minHeight: '420px',
                    background: 'rgba(255,255,255,0.02)',
                    color: 'var(--text-core)',
                    border: '1px solid rgba(148,163,184,0.16)',
                    padding: '18px',
                    resize: 'vertical',
                    fontFamily: 'var(--font-sys)',
                    fontSize: '0.84rem',
                    lineHeight: 1.6,
                  }}
                />
              ) : (
                <p style={{ color: 'var(--text-dim)' }}>
                  GENERATE THE DIRECTOR PROMPT, MAKE YOUR FULL VIDEO OUTSIDE THE APP, THEN UPLOAD THAT FINAL SILENT CUT HERE FOR VOICE + MUSIC MUXING.
                </p>
              )}
            </div>
          </div>

          <div className="scene-detail-panel">
            <div className="video-rail-header">
              <span className="label">ASSET BRIEF</span>
              <span className="value">{assetBrief.length} items</span>
            </div>
            <div className="scene-detail-body">
              {assetBrief.length > 0 ? (
                <div className="scene-assets">
                  {assetBrief.map((item, index) => (
                    <div key={`${item.sceneId}-${item.kind}-${item.query}-${index}`} className="scene-asset-row">
                      <div>
                        <span className="label">ASSET</span>
                        <strong>{summarizeAsset(item)}</strong>
                      </div>
                      <div>
                        <span className="label">SCENE</span>
                        <strong>{item.sceneId}</strong>
                      </div>
                      <div>
                        <span className="label">ROLE</span>
                        <strong>{item.role}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-dim)' }}>BUILD THE ASSET BRIEF TO SEE WHAT YOU SHOULD PREPARE.</p>
              )}
            </div>
          </div>

          <div className="scene-detail-panel">
            <div className="video-rail-header">
              <span className="label">SELECTED SCENE</span>
              <span className="value">{selectedScene?.sceneId || 'NONE'}</span>
            </div>
            {selectedScene ? (
              <div className="scene-detail-body">
                <h3>{selectedScene.headline || selectedScene.voiceText}</h3>
                <p>{selectedScene.subhead || selectedScene.visualIntent}</p>
                <div className="scene-meta-grid">
                  <div>
                    <span className="label">WINDOW</span>
                    <strong>
                      {selectedScene.startSec.toFixed(1)}s - {selectedScene.endSec.toFixed(1)}s
                    </strong>
                  </div>
                  <div>
                    <span className="label">TEMPLATE</span>
                    <strong>{selectedScene.template}</strong>
                  </div>
                  <div>
                    <span className="label">MOTION</span>
                    <strong>{selectedScene.motionLevel}</strong>
                  </div>
                  <div>
                    <span className="label">BIT</span>
                    <strong>{selectedScene.motionBitId || selectedScene.motionBit || 'auto'}</strong>
                  </div>
                </div>
                <div className="scene-keywords">
                  {selectedScene.keywords.map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="state-container" style={{ padding: '32px 24px' }}>
                <p style={{ color: 'var(--text-dim)' }}>NO SCENE SELECTED.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
