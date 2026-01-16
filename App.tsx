import React, { useState, useRef } from 'react';
import Scene from './components/Scene';
import HandController from './components/HandController';
import { ButterflyParams, ViewMode, HandState } from './types';

const App: React.FC = () => {
  const [params] = useState<ButterflyParams>({
    iter: 24, // 24 PI
    a: 1.0,   // exp(sin(t)) multiplier
    b: 2.0,   // cos(4t) multiplier
    c: 5.0,   // power of sin term
    scale: 3.5, // Increased size of butterfly
    color: '#8b5cf6' // Violet default
  });

  const [viewMode] = useState<ViewMode>(ViewMode.Orbit);
  
  // Mutable ref for high-frequency hand updates without re-renders
  const handStateRef = useRef<HandState>({
    detected: false,
    x: 0.5,
    y: 0.5,
    palmX: 0.5,
    palmY: 0.5,
    pinch: 1.0,
    rotation: 0,
    fingerTips: [
      { x: 0.5, y: 0.3, dirX: 0, dirY: -1 },
      { x: 0.5, y: 0.2, dirX: 0, dirY: -1 },
      { x: 0.5, y: 0.2, dirX: 0, dirY: -1 },
      { x: 0.5, y: 0.2, dirX: 0, dirY: -1 },
      { x: 0.5, y: 0.3, dirX: 0, dirY: -1 }
    ],
    blast: 0
  });

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      
      {/* Webcam Background - Full Screen */}
      <HandController handStateRef={handStateRef} />
      
      {/* 3D Scene Overlay */}
      <div className="absolute inset-0 z-10">
        <Scene params={params} viewMode={viewMode} handStateRef={handStateRef} />
      </div>

      {/* Footer / Branding */}
      <div className="absolute bottom-4 right-4 z-20 text-right pointer-events-none">
        <h2 className="text-white/80 font-bold text-xl tracking-tight">2D Butterfly</h2>
        <p className="text-white/40 text-xs">Temple H. Fay Parametric Visualization</p>
      </div>
    </div>
  );
};

export default App;