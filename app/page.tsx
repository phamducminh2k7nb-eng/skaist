'use client';

import { useMemo, useState } from 'react';
import { fal } from '@fal-ai/client';
import { Video, Image as ImageIcon, WandSparkles, History, Settings, Download, RotateCcw, Sparkles } from 'lucide-react';

fal.config({ proxyUrl: '/api/fal/proxy' });

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('Keep the character identity and outfit consistent. Reproduce the reference dance motion naturally with stable limbs and realistic body movement.');
  const [adaptMotion, setAdaptMotion] = useState(true);
  const [enhanceIdentity, setEnhanceIdentity] = useState(true);
  const [status, setStatus] = useState('Ready');
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  const imageUrl = useMemo(() => image ? URL.createObjectURL(image) : '', [image]);
  const videoUrl = useMemo(() => video ? URL.createObjectURL(video) : '', [video]);
  const busy = progress > 0 && progress < 100;

  async function generate() {
    if (!image || !video) {
      setError('Hãy tải đủ 1 ảnh nhân vật và 1 video chuyển động.');
      return;
    }
    if (image.size > 20 * 1024 * 1024) {
      setError('Ảnh vượt quá 20 MB.');
      return;
    }
    if (video.size > 100 * 1024 * 1024) {
      setError('Video vượt quá 100 MB.');
      return;
    }

    setError('');
    setResultUrl('');
    setProgress(8);
    setStatus('Uploading assets');

    try {
      const [imageRemoteUrl, videoRemoteUrl] = await Promise.all([
        fal.storage.upload(image),
        fal.storage.upload(video)
      ]);

      setProgress(28);
      setStatus('Analyzing motion');

      const result = await fal.subscribe('fal-ai/wan-motion', {
        input: {
          image_url: imageRemoteUrl,
          video_url: videoRemoteUrl,
          prompt,
          acceleration: 'regular',
          adapt_motion: adaptMotion,
          enhance_identity: enhanceIdentity,
          enable_safety_checker: true
        },
        logs: true,
        onQueueUpdate(update) {
          if (update.status === 'IN_QUEUE') {
            setProgress(38);
            setStatus('Queued for AI');
          }
          if (update.status === 'IN_PROGRESS') {
            setProgress(p => Math.max(p, 62));
            setStatus('Rendering motion');
          }
        }
      });

      const data = result.data as { video?: { url?: string } };
      if (!data.video?.url) throw new Error('AI engine did not return a video.');

      setResultUrl(data.video.url);
      setProgress(100);
      setStatus('Complete');
    } catch (e) {
      setProgress(0);
      setStatus('Ready');
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra khi tạo video.');
    }
  }

  function reset() {
    setImage(null); setVideo(null); setResultUrl(''); setError(''); setProgress(0); setStatus('Ready');
  }

  return <div className="shell">
    <header className="topbar">
      <div className="brand"><div className="brandmark"><Sparkles size={19}/></div><div>MOVA<small>Motion AI Studio</small></div></div>
      <div className="status"><div className="dot"/><span>Wan Motion ready</span></div>
    </header>
    <div className="layout">
      <aside className="sidebar">
        <div className="navitem active"><WandSparkles size={18}/> Create</div>
        <div className="navitem"><History size={18}/> History</div>
        <div className="navitem"><Settings size={18}/> Settings</div>
        <div className="sectionlabel">Workflow</div>
        <div className="navitem"><ImageIcon size={18}/> Character</div>
        <div className="navitem"><Video size={18}/> Motion</div>
      </aside>
      <main className="main">
        <section className="hero">
          <div><div className="eyebrow">Photo → Motion</div><h1>Turn any character photo into a dance video.</h1><p>Tải một ảnh nhân vật và một video điệu nhảy. MOVA dùng video làm driving motion rồi chuyển chuyển động sang nhân vật trong ảnh.</p></div>
          <div className="badge">Wan Motion · 720p</div>
        </section>
        <section className="workspace">
          <div className="canvas">
            <div className="canvas-head"><h2>Create motion video</h2><div className="step">01 / INPUT</div></div>
            <div className="upload-grid">
              <label className="drop">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImage(e.target.files?.[0]||null)}/>
                {imageUrl ? <img className="drop-preview" src={imageUrl} alt="character preview"/> : <div><div className="upload-icon"><ImageIcon/></div><h3>Character image</h3><p>JPG, PNG, WEBP<br/>Nên dùng ảnh toàn thân, rõ mặt và tay chân</p></div>}
              </label>
              <label className="drop">
                <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={e=>setVideo(e.target.files?.[0]||null)}/>
                {videoUrl ? <video className="drop-preview" src={videoUrl} controls muted/> : <div><div className="upload-icon"><Video/></div><h3>Motion reference</h3><p>MP4, MOV, WEBM<br/>Video có người nhảy rõ toàn thân sẽ tốt nhất</p></div>}
              </label>
            </div>
            <div className="swapline"><div className="line"/> IMAGE + MOTION → AI VIDEO <div className="line"/></div>
            <textarea className="prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} />
            <div className="actions">
              <button className="generate" onClick={generate} disabled={busy}><WandSparkles size={17} style={{verticalAlign:'middle',marginRight:8}}/>{busy ? status : 'Generate video'}</button>
              <button className="secondary" onClick={reset} title="Reset"><RotateCcw size={18}/></button>
            </div>
            {(progress > 0 || busy) && <div className="progress"><strong style={{fontSize:13}}>{status}</strong><div className="progressbar"><div className="progressfill" style={{width:`${progress}%`}}/></div></div>}
            {error && <div className="error">{error}</div>}
            {resultUrl && <div className="result"><video src={resultUrl} controls playsInline/><div className="actions"><a className="generate" href={resultUrl} download style={{textAlign:'center'}}><Download size={16} style={{verticalAlign:'middle',marginRight:7}}/>Download MP4</a><button className="secondary" onClick={reset}>Create new</button></div></div>}
          </div>
          <aside className="settings">
            <h2>Generation settings</h2>
            <div className="sectionlabel">Motion controls</div>
            <div className="row"><div><strong>Adapt motion</strong><span>Retarget chuyển động theo tỷ lệ nhân vật</span></div><button className={`switch ${adaptMotion?'on':''}`} onClick={()=>setAdaptMotion(v=>!v)}><div className="knob"/></button></div>
            <div className="row"><div><strong>Enhance identity</strong><span>Ưu tiên giữ mặt và đặc điểm nhân vật</span></div><button className={`switch ${enhanceIdentity?'on':''}`} onClick={()=>setEnhanceIdentity(v=>!v)}><div className="knob"/></button></div>
            <div className="sectionlabel">Output</div>
            <select className="select" value="720p" readOnly><option value="720p">720p · Wan Motion optimized</option></select>
            <p className="hint">Wan Motion nhận video làm driving motion, tự retarget pose và xuất video 720p. Bản này không tạo nút giả cho các tùy chọn engine chưa hỗ trợ.</p>
            <div className="sectionlabel">Color system</div>
            <div className="colors">
              <div className="swatch" style={{background:'#070A12'}}>#070A12</div>
              <div className="swatch" style={{background:'#7C5CFC'}}>#7C5CFC</div>
              <div className="swatch" style={{background:'#2DD4FF',color:'#071019'}}>#2DD4FF</div>
              <div className="swatch" style={{background:'#39E58C',color:'#071019'}}>#39E58C</div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  </div>
}
