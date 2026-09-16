'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fal } from '@fal-ai/client';
import { Video, Image as ImageIcon, WandSparkles, Settings, Download, RotateCcw, Sparkles, Layers3, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react';

fal.config({ proxyUrl: '/api/fal/proxy' });

type Resolution = '720p' | '2k' | '4k';
type JobState = 'waiting' | 'uploading' | 'motion' | 'upscale' | 'done' | 'error';
type HealthState = 'checking' | 'ok' | 'bad';

type BatchJob = {
  id: string;
  label: string;
  imageName: string;
  videoName: string;
  status: JobState;
  progress: number;
  resultUrl?: string;
  fallbackUrl?: string;
  error?: string;
  warning?: string;
};

function friendlyError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || 'Unknown error');
  const lower = raw.toLowerCase();
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid key') || lower.includes('revoked')) return 'FAL_KEY chưa đúng, đã bị thu hồi hoặc chưa được áp dụng trên Vercel Production.';
  if (lower.includes('403') || lower.includes('scope')) return 'FAL_KEY có tồn tại nhưng scope/quyền API chưa phù hợp.';
  if (lower.includes('402') || lower.includes('balance') || lower.includes('credit') || lower.includes('payment')) return 'Tài khoản fal.ai không đủ credit để chạy model.';
  if (lower.includes('429') || lower.includes('rate limit')) return 'fal.ai đang giới hạn tốc độ. Hãy thử lại sau ít phút.';
  if (lower.includes('safety') || lower.includes('nsfw') || lower.includes('moderation')) return 'Ảnh hoặc video bị bộ lọc an toàn từ chối.';
  if (lower.includes('413') || lower.includes('too large')) return 'File quá lớn để tải lên.';
  if (lower.includes('fetch') || lower.includes('network')) return 'Kết nối đến dịch vụ AI thất bại. Hãy thử lại.';
  return raw;
}

export default function Home() {
  const [images, setImages] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [resolution, setResolution] = useState<Resolution>('720p');
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<HealthState>('checking');
  const [healthMessage, setHealthMessage] = useState('Đang kiểm tra kết nối fal.ai...');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const imagePreview = useMemo(() => images[0] ? URL.createObjectURL(images[0]) : '', [images]);
  const videoPreview = useMemo(() => videos[0] ? URL.createObjectURL(videos[0]) : '', [videos]);

  async function checkFal(showError = false) {
    setHealth('checking');
    setHealthMessage('Đang kiểm tra kết nối fal.ai...');
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        const message = friendlyError(data?.reason || data?.detail || `Fal health check failed (${response.status}).`);
        setHealth('bad');
        setHealthMessage(message);
        if (showError) setError(message);
        return false;
      }
      setHealth('ok');
      setHealthMessage('fal.ai đã kết nối và FAL_KEY hợp lệ.');
      return true;
    } catch (e) {
      const message = friendlyError(e);
      setHealth('bad');
      setHealthMessage(message);
      if (showError) setError(message);
      return false;
    }
  }

  useEffect(() => {
    void checkFal(false);
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function createPairs() {
    if (!images.length || !videos.length) return [] as { image: File; video: File; label: string }[];
    if (images.length > 1 && videos.length > 1 && images.length !== videos.length) {
      throw new Error('Nếu chọn nhiều ảnh và nhiều video thì số lượng phải bằng nhau. Hoặc dùng 1 ảnh cho nhiều video / 1 video cho nhiều ảnh.');
    }
    const count = Math.max(images.length, videos.length);
    return Array.from({ length: count }, (_, i) => ({
      image: images.length === 1 ? images[0] : images[i],
      video: videos.length === 1 ? videos[0] : videos[i],
      label: `Video ${i + 1}`
    }));
  }

  function updateJob(id: string, patch: Partial<BatchJob>) {
    setJobs(current => current.map(job => job.id === id ? { ...job, ...patch } : job));
  }

  async function processPair(id: string, image: File, video: File, targetResolution: Resolution) {
    let motionUrl = '';
    try {
      updateJob(id, { status: 'uploading', progress: 8, error: undefined, warning: undefined });

      const [imageUrl, videoUrl] = await Promise.all([
        fal.storage.upload(image),
        fal.storage.upload(video)
      ]);

      updateJob(id, { status: 'motion', progress: 22 });

      const motionResult = await fal.subscribe('fal-ai/wan-motion', {
        input: {
          image_url: imageUrl,
          video_url: videoUrl,
          prompt: '',
          acceleration: 'regular',
          adapt_motion: false,
          enhance_identity: false,
          enable_safety_checker: true
        },
        pollInterval: 5000,
        logs: true,
        onQueueUpdate(update) {
          if (update.status === 'IN_QUEUE') updateJob(id, { status: 'motion', progress: 34 });
          if (update.status === 'IN_PROGRESS') updateJob(id, { status: 'motion', progress: 58 });
        }
      });

      const motionData = motionResult.data as { video?: { url?: string } };
      motionUrl = motionData?.video?.url || '';
      if (!motionUrl) throw new Error('Wan Motion không trả về video đầu ra.');

      if (targetResolution === '720p') {
        updateJob(id, { status: 'done', progress: 100, resultUrl: motionUrl });
        return;
      }

      updateJob(id, { status: 'upscale', progress: 72, fallbackUrl: motionUrl });

      try {
        const upscaleResult = await fal.subscribe('fal-ai/bytedance-upscaler/upscale/video', {
          input: {
            video_url: motionUrl,
            target_resolution: targetResolution,
            target_fps: '30fps',
            enhancement_preset: 'aigc',
            enhancement_tier: 'standard',
            fidelity: 'high'
          },
          pollInterval: 5000,
          logs: true,
          onQueueUpdate(update) {
            if (update.status === 'IN_QUEUE') updateJob(id, { status: 'upscale', progress: 80 });
            if (update.status === 'IN_PROGRESS') updateJob(id, { status: 'upscale', progress: 91 });
          }
        });

        const upscaleData = upscaleResult.data as { video?: { url?: string } };
        const finalUrl = upscaleData?.video?.url || '';
        if (!finalUrl) throw new Error('Upscaler không trả về video.');
        updateJob(id, { status: 'done', progress: 100, resultUrl: finalUrl, fallbackUrl: motionUrl });
      } catch (upscaleError) {
        updateJob(id, {
          status: 'done',
          progress: 100,
          resultUrl: motionUrl,
          fallbackUrl: motionUrl,
          warning: `Upscale ${targetResolution.toUpperCase()} lỗi, đã giữ lại bản 720p: ${friendlyError(upscaleError)}`
        });
      }
    } catch (e) {
      const message = friendlyError(e);
      updateJob(id, {
        status: 'error',
        progress: 0,
        resultUrl: motionUrl || undefined,
        error: message
      });
      setError(message);
    }
  }

  async function generate() {
    if (loading) return;
    setError('');

    const falReady = await checkFal(true);
    if (!falReady) return;

    try {
      const pairs = createPairs();
      if (!pairs.length) throw new Error('Hãy chọn ít nhất 1 ảnh nhân vật và 1 video điệu nhảy.');
      for (const file of images) if (file.size > 20 * 1024 * 1024) throw new Error(`Ảnh ${file.name} vượt quá 20 MB.`);
      for (const file of videos) if (file.size > 100 * 1024 * 1024) throw new Error(`Video ${file.name} vượt quá 100 MB.`);

      const initialJobs: BatchJob[] = pairs.map((pair, i) => ({
        id: `${Date.now()}-${i}`,
        label: pair.label,
        imageName: pair.image.name,
        videoName: pair.video.name,
        status: 'waiting',
        progress: 3
      }));

      setJobs(initialJobs);
      setLoading(true);

      for (let i = 0; i < pairs.length; i += 2) {
        const chunk = pairs.slice(i, i + 2);
        await Promise.allSettled(chunk.map((pair, offset) => {
          const index = i + offset;
          return processPair(initialJobs[index].id, pair.image, pair.video, resolution);
        }));
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  async function retryJob(job: BatchJob) {
    if (loading) return;
    setError('');
    const falReady = await checkFal(true);
    if (!falReady) return;
    const index = jobs.findIndex(j => j.id === job.id);
    if (index < 0) return;
    const pairs = createPairs();
    const pair = pairs[index];
    if (!pair) {
      setError('Không tìm thấy file gốc cho job này. Hãy chọn lại ảnh/video rồi Generate.');
      return;
    }
    setLoading(true);
    try {
      await processPair(job.id, pair.image, pair.video, resolution);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setImages([]);
    setVideos([]);
    setJobs([]);
    setError('');
    setLoading(false);
  }

  const completed = jobs.filter(j => j.status === 'done').length;

  return <div className="shell">
    <header className="topbar">
      <div className="brand"><div className="brandmark"><Sparkles size={19}/></div><div>MOVA<small>Motion AI Studio</small></div></div>
      <button type="button" className="status status-button" onClick={() => void checkFal(true)} title="Kiểm tra fal.ai">
        <div className={`dot ${health === 'bad' ? 'dot-bad' : health === 'checking' ? 'dot-warn' : ''}`}/>
        <span>{health === 'ok' ? 'fal.ai connected' : health === 'bad' ? 'fal.ai error' : 'checking fal.ai'}</span>
      </button>
    </header>

    <div className="layout">
      <aside className="sidebar">
        <button type="button" className="navitem active navbutton" onClick={() => scrollTo('create-section')}><WandSparkles size={18}/> Create</button>
        <button type="button" className="navitem navbutton" onClick={() => scrollTo('batch-section')}><Layers3 size={18}/> Batch</button>
        <button type="button" className="navitem navbutton" onClick={() => scrollTo('batch-section')}><PlayCircle size={18}/> Results</button>
        <button type="button" className="navitem navbutton" onClick={() => scrollTo('settings-section')}><Settings size={18}/> Settings</button>
        <div className="sectionlabel">Workflow</div>
        <button type="button" className="navitem navbutton" onClick={() => imageInputRef.current?.click()}><ImageIcon size={18}/> Character</button>
        <button type="button" className="navitem navbutton" onClick={() => videoInputRef.current?.click()}><Video size={18}/> Motion</button>
      </aside>

      <main className="main">
        <section className="hero">
          <div><div className="eyebrow">Motion Copy Studio</div><h1>Copy the dance. Keep the character.</h1><p>Chọn ảnh nhân vật và video mẫu. Hệ thống chuyển chuyển động từ video sang nhân vật và có thể xử lý nhiều file theo batch.</p></div>
          <div className="badge">Batch · 720p / 2K / 4K</div>
        </section>

        <section className="workspace" id="create-section">
          <div className="canvas">
            <div className="canvas-head"><h2>Input files</h2><div className="step">MULTI FILE</div></div>

            <div className={`health-banner ${health}`}>
              <strong>{health === 'ok' ? 'AI service ready' : health === 'bad' ? 'AI service error' : 'Checking AI service'}</strong>
              <span>{healthMessage}</span>
              <button type="button" onClick={() => void checkFal(true)}>Kiểm tra lại</button>
            </div>

            <div className="upload-grid">
              <label className="drop">
                <input ref={imageInputRef} id="image-upload" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e => { setImages(Array.from(e.target.files || [])); setError(''); }}/>
                {imagePreview ? <div className="preview-wrap"><img className="drop-preview" src={imagePreview} alt="character preview"/><div className="file-count">{images.length} ảnh đã chọn</div></div> : <div><div className="upload-icon"><ImageIcon/></div><h3>Character image(s)</h3><p>Chọn 1 hoặc nhiều ảnh cùng lúc</p></div>}
              </label>
              <label className="drop">
                <input ref={videoInputRef} id="video-upload" type="file" multiple accept="video/mp4,video/quicktime,video/webm" onChange={e => { setVideos(Array.from(e.target.files || [])); setError(''); }}/>
                {videoPreview ? <div className="preview-wrap"><video className="drop-preview" src={videoPreview} muted playsInline/><div className="file-count">{videos.length} video đã chọn</div></div> : <div><div className="upload-icon"><Video/></div><h3>Dance video(s)</h3><p>Chọn 1 hoặc nhiều video cùng lúc</p></div>}
              </label>
            </div>

            <div className="resolution-block">
              <div><strong>Output quality</strong><span>720p trực tiếp · 2K/4K upscale sau khi tạo</span></div>
              <div className="resolution-tabs">
                {(['720p','2k','4k'] as Resolution[]).map(r => <button type="button" key={r} className={resolution === r ? 'resolution active' : 'resolution'} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setResolution(r); }}>{r === '2k' ? '2K' : r === '4k' ? '4K' : '720p'}</button>)}
              </div>
            </div>

            <div className="actions clickable-actions">
              <button type="button" className="generate" onClick={generate} disabled={loading || health === 'checking'}><WandSparkles size={17} style={{verticalAlign:'middle', marginRight:8}}/>{loading ? `Processing ${jobs.length} file(s)...` : `Generate${Math.max(images.length, videos.length) > 1 ? ' batch' : ' video'}`}</button>
              <button type="button" className="secondary" onClick={reset} title="Reset"><RotateCcw size={18}/></button>
            </div>

            {error && <div className="error">{error}</div>}

            {jobs.length > 0 && <div className="batch-results" id="batch-section">
              <div className="batch-head"><h2>Batch progress</h2><span>{completed}/{jobs.length} completed</span></div>
              <div className="job-grid">
                {jobs.map(job => <div className="job-card" key={job.id}>
                  <div className="job-title"><div><strong>{job.label}</strong><span>{job.videoName}</span></div>{job.status === 'done' ? <CheckCircle2 size={19}/> : job.status === 'error' ? <AlertCircle size={19}/> : <div className="job-spinner"/>}</div>
                  <div className="job-status">{job.status === 'waiting' ? 'Waiting' : job.status === 'uploading' ? 'Uploading files' : job.status === 'motion' ? 'Copying motion' : job.status === 'upscale' ? `Upscaling to ${resolution.toUpperCase()}` : job.status === 'done' ? 'Complete' : 'Failed'}</div>
                  <div className="progressbar"><div className="progressfill" style={{width:`${job.progress}%`}}/></div>
                  {job.error && <div className="job-error">{job.error}</div>}
                  {job.status === 'error' && <button type="button" className="retry-btn" onClick={() => retryJob(job)} disabled={loading}>Retry</button>}
                  {job.warning && <div className="job-warning">{job.warning}</div>}
                  {job.resultUrl && <><video className="job-video" src={job.resultUrl} controls playsInline/><a className="download-btn" href={job.resultUrl} target="_blank" rel="noreferrer"><Download size={15}/> Open / Download result</a></>}
                </div>)}
              </div>
            </div>}
          </div>

          <aside className="settings compact-settings" id="settings-section">
            <h2>Generation</h2>
            <div className="stat-card"><span>AI status</span><strong>{health === 'ok' ? 'Connected' : health === 'bad' ? 'Error' : 'Checking'}</strong></div>
            <div className="stat-card"><span>Motion mode</span><strong>Direct copy</strong></div>
            <div className="stat-card"><span>Identity</span><strong>Stable</strong></div>
            <div className="stat-card"><span>Batch</span><strong>2 concurrent</strong></div>
            <div className="stat-card"><span>Output</span><strong>{resolution === '720p' ? '720p' : resolution.toUpperCase()}</strong></div>
          </aside>
        </section>
      </main>
    </div>
  </div>
}
