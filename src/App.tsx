import React from 'react';
import VideoAnnotator from './components/VideoAnnotator';

export default function App() {
  return (
    <div style={{fontFamily: 'system-ui, Arial, sans-serif', padding: 8}}>
      <h3 style={{margin: 6}}>Tauri Video Annotator — Prototype</h3>
      <VideoAnnotator />
    </div>
  );
}
