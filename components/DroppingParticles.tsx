import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ButterflyParams } from '../types';

interface DroppingParticlesProps {
  params: ButterflyParams;
}

const vertexShader = `
  attribute float aOpacity;
  attribute float aRandom;
  uniform float uSize;
  uniform float uTime;
  varying float vOpacity;
  varying float vRandom;
  
  void main() {
    vOpacity = aOpacity;
    vRandom = aRandom;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    gl_PointSize = uSize * (25.0 / -mvPosition.z);
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  varying float vOpacity;

  void main() {
    // Soft Circular Particle
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;

    // Glow gradient: center is bright, edges fade
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5); // Tune sharpness

    // Alpha is controlled by particle life (vOpacity) and radial glow
    float alpha = glow * vOpacity * 0.8;
    
    // Mix core color with white for a "hot" center
    vec3 finalColor = mix(uColor, vec3(1.0), glow * 0.5);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const DroppingParticles: React.FC<DroppingParticlesProps> = ({ params }) => {
  const count = 1200;
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // particleData: [x, y, z, life]
  const particleData = useMemo(() => {
    const data = new Float32Array(count * 4);
    for(let i=0; i<count; i++) {
        // Initialize with random negative life to stagger spawning
        data[i*4 + 3] = -Math.random() * 5.0; 
    }
    return data;
  }, []);

  const { positions, opacities, randoms } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ops = new Float32Array(count);
    const rnd = new Float32Array(count);
    
    for(let i=0; i<count; i++) {
        rnd[i] = Math.random();
    }
    return { positions: pos, opacities: ops, randoms: rnd };
  }, []);

  useFrame((state, delta) => {
    if (!geometryRef.current) return;
    if (materialRef.current) {
        materialRef.current.uniforms.uColor.value.set(params.color);
        materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }

    const dt = Math.min(delta, 0.1);
    
    // Tilt parameters matching ButterflyCurve (30 deg back)
    const tilt = -Math.PI / 6;
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);

    for (let i = 0; i < count; i++) {
      let life = particleData[i * 4 + 3];

      if (life > 0) {
        // --- UPDATE ALIVE ---
        life -= dt * 0.5; // Fade speed
        
        // Physics: Fall down (World Y) and drift
        particleData[i * 4 + 1] -= dt * 2.0; // Gravity
        
        // Slight horizontal noise/drift
        const drift = Math.sin(state.clock.elapsedTime * 1.5 + randoms[i] * 10.0) * 0.3;
        particleData[i * 4 + 0] += drift * dt; 

        // Update buffers
        positions[i * 3] = particleData[i * 4];
        positions[i * 3 + 1] = particleData[i * 4 + 1];
        positions[i * 3 + 2] = particleData[i * 4 + 2];
        opacities[i] = life;
        
        particleData[i * 4 + 3] = life;
      } else {
        // --- WAITING OR RESPAWN ---
        if (life < 0) {
             particleData[i * 4 + 3] += dt;
        } else {
            // Respawn
            const t = Math.random() * params.iter * Math.PI;
            
            // Calculate base position on curve (flat)
            const r =
                params.a * Math.exp(Math.sin(t)) -
                params.b * Math.cos(4 * t) +
                Math.pow(Math.sin((2 * t - Math.PI) / 24), params.c);

            const x = r * Math.cos(t) * params.scale;
            const yRaw = r * Math.sin(t) * params.scale;
            const zRaw = (Math.random() - 0.5) * 0.5; // Random thickness

            // Apply same Tilt rotation as ButterflyCurve
            const y = yRaw * cosTilt - zRaw * sinTilt;
            const z = yRaw * sinTilt + zRaw * cosTilt;

            particleData[i * 4] = x;
            particleData[i * 4 + 1] = y;
            particleData[i * 4 + 2] = z;
            particleData[i * 4 + 3] = 1.0; // Reset life
            
            // Update buffers to new position immediately
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            opacities[i] = 1.0; 
        }
      }
    }

    geometryRef.current.attributes.position.needsUpdate = true;
    geometryRef.current.attributes.aOpacity.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-aOpacity"
          count={count}
          array={opacities}
          itemSize={1}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={count}
          array={randoms}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uColor: { value: new THREE.Color(params.color) },
          uTime: { value: 0 },
          uSize: { value: 4.0 } // Reduced size to match fine curve
        }}
      />
    </points>
  );
};

export default DroppingParticles;