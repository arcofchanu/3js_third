import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { HandState } from '../types';

interface NumberProjectile {
  id: number;
  number: number;
  fingerIndex: number;
  startTime: number;
  startX: number;
  startY: number;
  dirX: number;
  dirY: number;
  speed: number;
  angle: number; // Spread angle offset
  scale: number;
}

interface NumberProjectilesProps {
  handStateRef: React.MutableRefObject<HandState>;
}

const NumberProjectiles: React.FC<NumberProjectilesProps> = ({ handStateRef }) => {
  const [projectiles, setProjectiles] = useState<NumberProjectile[]>([]);
  const nextIdRef = useRef(0);
  const lastSpawnTimeRef = useRef<number[]>([0, 0, 0, 0, 0]);
  const groupRef = useRef<THREE.Group>(null);

  // Spawn new projectiles periodically
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const hand = handStateRef.current;
    
    if (!hand.detected || !hand.fingerTips) return;
    
    // Calculate magic mode (only spawn when in magic mode)
    const magicMode = THREE.MathUtils.smoothstep(hand.pinch, 0.3, 0.8);
    if (magicMode < 0.5) return;
    
    // Calculate camera frustum for world coordinates
    const camera = state.camera as THREE.PerspectiveCamera;
    const distance = camera.position.z;
    const vFOV = (camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFOV / 2) * distance;
    const width = height * camera.aspect;
    
    // Blend position based on magic mode
    const targetX = THREE.MathUtils.lerp(hand.x, hand.palmX, magicMode);
    const targetY = THREE.MathUtils.lerp(hand.y, hand.palmY, magicMode);
    const worldCenterX = (targetX - 0.5) * width;
    const worldCenterY = -(targetY - 0.5) * height;
    
    // Spawn rate per finger
    const spawnInterval = 0.15 + Math.random() * 0.1; // Random interval between spawns
    
    const newProjectiles: NumberProjectile[] = [];
    
    hand.fingerTips.forEach((tip, fingerIndex) => {
      if (time - lastSpawnTimeRef.current[fingerIndex] > spawnInterval) {
        // Random chance to spawn (not every frame)
        if (Math.random() > 0.4) {
          lastSpawnTimeRef.current[fingerIndex] = time;
          
          // Outer radius of magic circle in world units (scaled)
          const outerRadius = 10.5 * (0.8 + hand.pinch * 1.5); // Match the scale from Scene
          
          // Calculate spawn position at outer radius along finger direction
          const dirAngle = Math.atan2(tip.dirY, tip.dirX);
          const spreadAngle = (Math.random() - 0.5) * 0.6; // Spread cone
          const finalAngle = dirAngle + spreadAngle;
          
          const spawnX = worldCenterX + Math.cos(finalAngle) * outerRadius;
          const spawnY = worldCenterY + Math.sin(finalAngle) * outerRadius;
          
          newProjectiles.push({
            id: nextIdRef.current++,
            number: Math.floor(Math.random() * 10), // Random digit 0-9
            fingerIndex,
            startTime: time,
            startX: spawnX,
            startY: spawnY,
            dirX: Math.cos(finalAngle),
            dirY: Math.sin(finalAngle),
            speed: 15 + Math.random() * 10, // Random speed
            angle: finalAngle,
            scale: 0.8 + Math.random() * 0.6
          });
        }
      }
    });
    
    if (newProjectiles.length > 0) {
      setProjectiles(prev => [...prev, ...newProjectiles]);
    }
    
    // Clean up old projectiles
    setProjectiles(prev => prev.filter(p => time - p.startTime < 2.0));
  });

  return (
    <group ref={groupRef}>
      {projectiles.map(proj => (
        <ProjectileNumber key={proj.id} projectile={proj} />
      ))}
    </group>
  );
};

// Individual projectile number component
const ProjectileNumber: React.FC<{ projectile: NumberProjectile }> = ({ projectile }) => {
  const textRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!textRef.current) return;
    
    const elapsed = state.clock.getElapsedTime() - projectile.startTime;
    const lifetime = 2.0;
    const progress = elapsed / lifetime;
    
    if (progress >= 1) return;
    
    // Position: move outward from spawn point
    const distance = elapsed * projectile.speed;
    const x = projectile.startX + projectile.dirX * distance;
    const y = projectile.startY + projectile.dirY * distance;
    const z = Math.sin(elapsed * 3) * 2; // Slight wave in Z
    
    textRef.current.position.set(x, y, z);
    
    // Fade out and shrink
    const fadeOut = 1 - progress;
    const scale = projectile.scale * (1 + progress * 0.5) * fadeOut;
    textRef.current.scale.setScalar(scale);
    
    // Rotate slightly
    textRef.current.rotation.z += 0.02;
    
    // Update opacity
    const material = textRef.current.material as THREE.MeshBasicMaterial;
    if (material && 'opacity' in material) {
      material.opacity = fadeOut * 0.9;
    }
  });
  
  // Color based on finger (gradient from cyan to purple)
  const colors = ['#00ffff', '#00e5ff', '#00d4ff', '#00c3ff', '#00b0ff'];
  const color = colors[projectile.fingerIndex % colors.length];
  
  return (
    <Text
      ref={textRef}
      fontSize={2}
      color={color}
      anchorX="center"
      anchorY="middle"
      font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf"
      material-transparent={true}
      material-opacity={0.9}
      material-blending={THREE.AdditiveBlending}
      material-depthWrite={false}
    >
      {projectile.number}
    </Text>
  );
};

export default NumberProjectiles;
