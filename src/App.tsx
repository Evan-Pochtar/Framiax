import React from "react";
import VideoAnnotator from "./components/VideoAnnotator";
import "./styles.css";

export default function App() {
  return (
    <div className="app">
      <header className="header">Video Annotator</header>
      <main className="main">
        <VideoAnnotator />
      </main>
    </div>
  );
}
