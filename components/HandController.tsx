import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandState, FingerTip } from '../types';
import { Camera, Loader2 } from 'lucide-react';

interface HandControllerProps {
  handStateRef: React.MutableRefObject<HandState>;
}

const HandController: React.FC<HandControllerProps> = ({ handStateRef }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        setIsLoading(false);
        startCamera();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        setIsLoading(false);
      }
    };

    initMediaPipe();

    return () => {
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
    };
  }, []);

  const startCamera = async () => {
    if (!videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 240 } 
      });
      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener('loadeddata', predictWebcam);
      setHasPermission(true);
    } catch (err) {
      console.error("Camera permission denied", err);
      setHasPermission(false);
    }
  };

  const predictWebcam = () => {
    if (!videoRef.current || !landmarkerRef.current) return;

    const startTimeMs = performance.now();
    
    if (videoRef.current.videoWidth > 0) {
       const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

       if (results.landmarks && results.landmarks.length > 0) {
         const landmarks = results.landmarks[0];
         
         // 1. Calculate Pinch Point (midpoint between thumb tip and index tip)
         const thumbTip = landmarks[4];
         const indexTip = landmarks[8];
         
         // Pinch center - midpoint between thumb and index finger
         const pinchX = (thumbTip.x + indexTip.x) / 2;
         const pinchY = (thumbTip.y + indexTip.y) / 2;
         
         // 2. Calculate Palm Center (average of wrist and base of all fingers)
         const wrist = landmarks[0];
         const thumbBase = landmarks[1];
         const indexBase = landmarks[5];
         const middleBase = landmarks[9];
         const ringBase = landmarks[13];
         const pinkyBase = landmarks[17];
         
         const palmCenterX = (wrist.x + thumbBase.x + indexBase.x + middleBase.x + ringBase.x + pinkyBase.x) / 6;
         const palmCenterY = (wrist.y + thumbBase.y + indexBase.y + middleBase.y + ringBase.y + pinkyBase.y) / 6;
         
         // 3. Calculate Pinch Distance
         const pinchDx = thumbTip.x - indexTip.x;
         const pinchDy = thumbTip.y - indexTip.y;
         const pinchDz = thumbTip.z - indexTip.z;
         const dist = Math.sqrt(pinchDx*pinchDx + pinchDy*pinchDy + pinchDz*pinchDz);

         // Normalize dist roughly (0.02 is touching, 0.2 is open)
         const pinchStrength = Math.min(Math.max((dist - 0.02) / 0.15, 0), 1);

         // 4. Calculate Rotation (Roll)
         // Use Wrist (0) and Middle Finger MCP (9) to determine orientation
         const middleMCP = landmarks[9];
         
         // Calculate vector from wrist to middle finger
         const vecX = middleMCP.x - wrist.x;
         const vecY = middleMCP.y - wrist.y;
         
         // Calculate angle relative to "Up" (-Y direction)
         const rotationRad = Math.atan2(vecY, vecX) + Math.PI / 2;
         
         // 5. Calculate Fingertip Positions and Directions
         // Fingertip landmark indices: thumb=4, index=8, middle=12, ring=16, pinky=20
         const fingerTipIndices = [4, 8, 12, 16, 20];
         const fingerMCPIndices = [2, 5, 9, 13, 17]; // Base knuckles for each finger
         
         const fingerTips: FingerTip[] = fingerTipIndices.map(idx => {
           const tip = landmarks[idx];
           // Direction from palm center to fingertip (outward)
           const dirX = tip.x - palmCenterX;
           const dirY = tip.y - palmCenterY;
           const len = Math.sqrt(dirX * dirX + dirY * dirY);
           return {
             x: 1.0 - tip.x, // Mirror for camera
             y: tip.y,
             dirX: len > 0.001 ? -dirX / len : 0, // Mirror direction
             dirY: len > 0.001 ? dirY / len : 0
           };
         });
         
         // 6. Detect Stop/Punch gesture (open palm or closed fist)
         // Check if all fingers are extended (open palm) or all curled (fist)
         let fingersExtended = 0;
         let fingersCurled = 0;
         
         // For index, middle, ring, pinky (skip thumb - different mechanics)
         for (let i = 1; i < 5; i++) {
           const tipIdx = fingerTipIndices[i];
           const mcpIdx = fingerMCPIndices[i];
           const tip = landmarks[tipIdx];
           const mcp = landmarks[mcpIdx];
           
           // Finger is extended if tip is further from wrist than MCP
           const tipDistToWrist = Math.sqrt(
             Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2)
           );
           const mcpDistToWrist = Math.sqrt(
             Math.pow(mcp.x - wrist.x, 2) + Math.pow(mcp.y - wrist.y, 2)
           );
           
           if (tipDistToWrist > mcpDistToWrist * 1.2) {
             fingersExtended++;
           } else if (tipDistToWrist < mcpDistToWrist * 0.9) {
             fingersCurled++;
           }
         }
         
         // Blast triggers only on fist (closed hand)
         const isFist = fingersCurled >= 3 && pinchStrength < 0.3; // Closed fist
         const blastValue = isFist ? 1.0 : 0.0;

         // Update ref directly to avoid React re-renders
         handStateRef.current = {
           detected: true,
           // Pinch point position (for butterfly)
           x: 1.0 - pinchX, 
           y: pinchY,
           // Palm center position (for magic circle)
           palmX: 1.0 - palmCenterX,
           palmY: palmCenterY,
           pinch: pinchStrength,
           rotation: rotationRad,
           fingerTips: fingerTips,
           blast: blastValue
         };
       } else {
         handStateRef.current = { ...handStateRef.current, detected: false };
       }
    }

    requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <Loader2 className="w-12 h-12 animate-spin text-white/50" />
        </div>
      )}
      
      {!hasPermission && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-black p-4">
            <Camera className="w-16 h-16 text-red-400 mb-4" />
            <span className="text-lg text-white/80 leading-tight">Camera Access Blocked</span>
            <span className="text-sm text-white/50 mt-2">Please allow camera permissions to use hand tracking</span>
        </div>
      )}

      <video 
        ref={videoRef}
        autoPlay 
        playsInline
        className={`w-full h-full object-cover transform -scale-x-100 ${isLoading ? 'hidden' : 'block'}`}
      />
      
      <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-xs font-mono text-white/70 uppercase tracking-widest pointer-events-none">
        Hand Tracking Active
      </div>
    </div>
  );
};

export default HandController;