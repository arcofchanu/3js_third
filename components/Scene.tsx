import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import ButterflyCurve from './ButterflyCurve';
import NumberProjectiles from './NumberProjectiles';
import { ButterflyParams, ViewMode, HandState } from '../types';

interface SceneProps {
  params: ButterflyParams;
  viewMode: ViewMode;
  handStateRef: React.MutableRefObject<HandState>;
}

const InteractiveButterfly = ({ params, handStateRef }: { params: ButterflyParams, handStateRef: React.MutableRefObject<HandState> }) => {
  const groupRef = useRef<THREE.Group>(null);
  const currentScale = useRef(1.0);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const hand = handStateRef.current;

    if (hand.detected) {
       // Hand interaction logic - INSTANT position tracking (no lerp)
       
       // Calculate visible area at z=0 plane based on camera frustum
       const camera = state.camera;
       const distance = camera.position.z;
       const vFOV = (camera.fov * Math.PI) / 180;
       const height = 2 * Math.tan(vFOV / 2) * distance;
       const width = height * camera.aspect;
       
       // Determine magic mode based on pinch strength
       const magicMode = THREE.MathUtils.smoothstep(hand.pinch, 0.3, 0.8);
       
       // Butterfly uses pinch point, magic circle uses palm center
       // Blend between them based on magic mode
       const targetX = THREE.MathUtils.lerp(hand.x, hand.palmX, magicMode);
       const targetY = THREE.MathUtils.lerp(hand.y, hand.palmY, magicMode);
       
       // Map normalized position to world coordinates
       const worldX = (targetX - 0.5) * width;
       const worldY = -(targetY - 0.5) * height;
       
       // INSTANT position update - no interpolation for immediate response
       groupRef.current.position.set(worldX, worldY, 0);
       
       // INSTANT rotation update
       groupRef.current.rotation.set(0, 0, hand.rotation);
       
       // Slightly smoothed scale for visual comfort
       const scaleVal = 0.8 + hand.pinch * 1.5;
       currentScale.current = THREE.MathUtils.lerp(currentScale.current, scaleVal, 0.3);
       groupRef.current.scale.setScalar(currentScale.current);
    } else {
        // Reset position to center slowly
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, 0, delta * 3);
        groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, delta * 3);
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, 0, delta * 3);
        
        // Reset scale slowly if hand lost
        currentScale.current = THREE.MathUtils.lerp(currentScale.current, 1.0, delta * 2);
        groupRef.current.scale.setScalar(currentScale.current);
        
        // Reset rotation to 0 slowly
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, delta * 2);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, delta * 2);
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, delta * 2);
    }
  });

  return (
    <group ref={groupRef}>
      <ButterflyCurve params={params} handStateRef={handStateRef} />
    </group>
  );
};

const Scene: React.FC<SceneProps> = ({ params, viewMode, handStateRef }) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 50], fov: 60 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        {/* Transparent background - no color attached */}
        
        <ambientLight intensity={0.5} />
        
        <InteractiveButterfly params={params} handStateRef={handStateRef} />
        
        {/* Random numbers shooting from fingertips */}
        <NumberProjectiles handStateRef={handStateRef} />

        <OrbitControls 
          autoRotate={viewMode === ViewMode.AutoRotate && !handStateRef.current?.detected}
          autoRotateSpeed={2.0}
          enableDamping={true}
          dampingFactor={0.05}
          enableRotate={!handStateRef.current?.detected}
          enabled={!handStateRef.current?.detected}
        />
        
      </Suspense>
    </Canvas>
  );
};

export default Scene;