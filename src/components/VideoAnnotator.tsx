import React, { useRef, useState, useEffect } from 'react';
import { Annotation, Point, Stroke, TextNote } from '../types';
import { uid, simplify, clamp } from '../utils';

const DEFAULT_COLOR = '#ffdd00';
const DEFAULT_WIDTH = 3;

export default function VideoAnnotator(){
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const fileInputRef = useRef<HTMLInputElement|null>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [mode, setMode] = useState<'none'|'draw'|'text'>('none');
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [playing, setPlaying] = useState(false);

  // sync canvas size with video
  useEffect(()=> {
    const v = videoRef.current;
    const c = canvasRef.current;
    if(!v || !c) return;
    function resize(){
      c.width = v.clientWidth;
      c.height = v.clientHeight;
      render();
    }
    window.addEventListener('resize', resize);
    v.addEventListener('loadedmetadata', resize);
    resize();
    return ()=> {
      window.removeEventListener('resize', resize);
      v.removeEventListener('loadedmetadata', resize);
    };
  }, [annotations]);

  // render overlay on timeupdate or changes
  useEffect(()=> {
    const v = videoRef.current;
    if(!v) return;
    const onTime = () => render();
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', ()=> setPlaying(true));
    v.addEventListener('pause', ()=> setPlaying(false));
    return ()=> v.removeEventListener('timeupdate', onTime);
  }, [annotations, currentStroke]);

  function render(){
    const v = videoRef.current;
    const c = canvasRef.current;
    if(!v || !c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0,0,c.width,c.height);
    const t = v.currentTime;
    const w = c.width, h = c.height;

    // draw annotations if timestamp is within window (show instant annotations when close)
    for(const a of annotations){
      if(a.type === 'stroke'){
        const s = a as Stroke;
        if(Math.abs(s.timestamp - t) > 2) continue;
        ctx.beginPath();
        ctx.lineWidth = s.width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = s.color;
        const pts = s.points;
        if(!pts.length) continue;
        ctx.moveTo(pts[0].x * w, pts[0].y * h);
        for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
        ctx.stroke();
      } else {
        const n = a as TextNote;
        if(Math.abs(n.timestamp - t) > 2) continue;
        ctx.font = '18px sans-serif';
        ctx.fillStyle = n.color;
        ctx.fillText(n.text, n.x * w, n.y * h);
      }
    }

    // draw live stroke
    if(currentStroke){
      ctx.beginPath();
      ctx.lineWidth = currentStroke.width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = currentStroke.color;
      const pts = currentStroke.points;
      if(pts.length>0){
        ctx.moveTo(pts[0].x * w, pts[0].y * h);
        for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
        ctx.stroke();
      }
    }
  }

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if(!f) return;
    const url = URL.createObjectURL(f);
    const v = videoRef.current!;
    v.src = url;
    v.load();
    setAnnotations([]);
  }

  // pointer drawing
  function toNorm(pt: {x:number;y:number}) {
    const c = canvasRef.current!;
    return { x: clamp(pt.x / c.width), y: clamp(pt.y / c.height) };
  }

  function onPointerDown(e: React.PointerEvent){
    if(mode !== 'draw') return;
    const v = videoRef.current!;
    if(!v) return;
    const rect = (e.target as Element).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const p = toNorm({x,y});
    const stroke: Stroke = {
      id: uid('s'),
      type: 'stroke',
      timestamp: v.currentTime,
      points: [p],
      color,
      width
    };
    setCurrentStroke(stroke);
  }

  function onPointerMove(e: React.PointerEvent){
    if(!currentStroke) return;
    const rect = (e.target as Element).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const p = toNorm({x,y});
    setCurrentStroke((s)=>{
      if(!s) return s;
      return {...s, points: [...s.points, p]};
    });
  }

  function onPointerUp(){
    if(!currentStroke) return;
    // simplify points then commit
    const simple = simplify(currentStroke.points, 0.003);
    const committed = {...currentStroke, points: simple};
    setAnnotations((a)=>[...a, committed]);
    setCurrentStroke(null);
  }

  // add text note
  function addTextNote(){
    const text = prompt('Text note:');
    if(!text) return;
    const v = videoRef.current!;
    // default top-left anchor
    const x = 0.05, y = 0.1;
    const note: TextNote = {
      id: uid('t'),
      type: 'text',
      timestamp: v.currentTime,
      x, y, text, color
    };
    setAnnotations((a)=>[...a, note]);
  }

  function jumpTo(annotation: Annotation){
    const v = videoRef.current!;
    v.currentTime = annotation.timestamp;
    v.pause();
    render();
  }

  function exportJSON(){
    const payload = {
      createdAt: new Date().toISOString(),
      videoUrl: (videoRef.current?.src) || null,
      annotations
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll(){ setAnnotations([]); }

  return (
    <div style={{display:'flex',gap:12}}>
      <div style={{flex:1}}>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
          <button onClick={handleFileSelect}>Load Video</button>
          <input ref={fileInputRef} type="file" accept="video/*" style={{display:'none'}} onChange={onFileChange}/>
          <button onClick={()=> setMode(mode==='draw'?'none':'draw')}>{mode==='draw'?'Stop Drawing':'Draw'}</button>
          <button onClick={()=> setMode('text')}>Add Text</button>
          <button onClick={()=> { videoRef.current?.play(); setPlaying(true); }}>Play</button>
          <button onClick={()=> { videoRef.current?.pause(); setPlaying(false); }}>Pause</button>
          <label style={{display:'flex',alignItems:'center',gap:6}}>
            Color
            <input type="color" value={color} onChange={e=>setColor(e.target.value)} />
          </label>
          <label style={{display:'flex',alignItems:'center',gap:6}}>
            Width
            <input type="range" min={1} max={20} value={width} onChange={e=>setWidth(Number(e.target.value))} />
          </label>
          <button onClick={exportJSON}>Export JSON</button>
          <button onClick={clearAll}>Clear</button>
        </div>

        <div style={{position:'relative', width: '100%', maxWidth: 1000, background:'#000'}}>
          <video
            ref={videoRef}
            controls
            style={{width:'100%', display:'block'}}
            crossOrigin="anonymous"
            playsInline
          />
          <canvas
            ref={canvasRef}
            style={{position:'absolute', left:0, top:0, right:0, bottom:0, width:'100%', height:'100%', touchAction:'none'}}
            onPointerDown={(e)=> {
              if(mode === 'text'){ addTextNote(); setMode('none'); return; }
              onPointerDown(e);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
      </div>

      <div style={{width:300}}>
        <div style={{marginBottom:8}}>Annotations ({annotations.length})</div>
        <div style={{maxHeight:520, overflow:'auto', border:'1px solid #ddd', padding:6}}>
          {annotations.slice().reverse().map(a => (
            <div key={a.id} style={{padding:6,borderBottom:'1px solid #eee', cursor:'pointer'}}>
              <div style={{fontSize:12}}>
                <strong>{a.type}</strong> @ {a.timestamp.toFixed(2)}s
              </div>
              {'points' in a ? (
                <div style={{fontSize:12}}>points: {a.points.length} color: {a.color}</div>
              ) : (
                <div style={{fontSize:12}}>text: {(a as any).text}</div>
              )}
              <div style={{marginTop:6}}>
                <button onClick={()=> jumpTo(a)}>Go</button>
                <button onClick={()=>{
                  setAnnotations(prev => prev.filter(x => x.id !== a.id));
                }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
