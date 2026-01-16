import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ButterflyParams, HandState } from '../types';

interface ButterflyCurveProps {
  params: ButterflyParams;
  handStateRef?: React.MutableRefObject<HandState>;
}

const vertexShader = `
  attribute float aProgress;
  uniform float uTime;
  uniform float uSize;
  uniform float uMagic; // 0.0 to 1.0 (1.0 = full magic mode)
  uniform float uPinch; // 0.0 to 1.0 (finger distance - 0 = touching, 1 = open)
  uniform float uVisible; // 0.0 = hidden, 1.0 = visible
  uniform float uRotation; // Palm rotation angle
  uniform float uBlast; // 0.0 to 1.0 (blast/scatter effect)
  uniform float uBlastTime; // Time when blast started
  varying float vProgress;
  varying float vVisible;
  varying float vMagic;
  varying float vRingID;
  varying float vIsInnerCircle;
  varying float vRandom;
  varying float vOrbTrail; // Trail intensity for orbs (1.0 = head, 0.0 = tail)
  varying float vBlastAlpha; // Alpha for blast fade out
  
  // Pseudo-random function
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    vProgress = aProgress;
    vMagic = uMagic;
    vVisible = uVisible;
    vIsInnerCircle = 0.0;
    vRandom = hash(aProgress * 123.45);
    vOrbTrail = 1.0; // Default full intensity
    vBlastAlpha = 1.0; // Default full alpha
    
    // 1. Base Orb Position (geometrical structures)
    vec3 orbPos = position;
    
    // Determine structure based on progress
    float structure = 0.0;
    if (aProgress < 0.2) structure = 0.0;      // Icosahedron
    else if (aProgress < 0.5) structure = 1.0; // Rings
    else if (aProgress < 0.8) structure = 2.0; // Spirals
    else structure = 3.0;                       // Floating particles
    
    vec3 rotated = orbPos;
    
    if (structure < 0.5) {
        // Icosahedron: slow majestic rotation
        float rotY = uTime * 0.3;
        float rotX = uTime * 0.2;
        float cosY = cos(rotY); float sinY = sin(rotY);
        float cosX = cos(rotX); float sinX = sin(rotX);
        rotated = vec3(
            orbPos.x * cosY - orbPos.z * sinY,
            orbPos.y * cosX - (orbPos.x * sinY + orbPos.z * cosY) * sinX,
            orbPos.y * sinX + (orbPos.x * sinY + orbPos.z * cosY) * cosX
        );
    } else if (structure < 1.5) {
        // Rings: each ring rotates differently
        float ringIdx = floor((aProgress - 0.2) / 0.1);
        float rotSpeed = 0.4 + ringIdx * 0.2;
        float rotDir = mod(ringIdx, 2.0) < 1.0 ? 1.0 : -1.0;
        float rot = uTime * rotSpeed * rotDir;
        float c = cos(rot); float s = sin(rot);
        if (ringIdx < 1.0) rotated = vec3(orbPos.x * c - orbPos.y * s, orbPos.x * s + orbPos.y * c, orbPos.z);
        else if (ringIdx < 2.0) rotated = vec3(orbPos.x * c - orbPos.z * s, orbPos.y, orbPos.x * s + orbPos.z * c);
        else rotated = vec3(orbPos.x, orbPos.y * c - orbPos.z * s, orbPos.y * s + orbPos.z * c);
    } else if (structure < 2.5) {
        // Spirals: gentle twist
        float twist = uTime * 0.5;
        float c = cos(twist); float s = sin(twist);
        rotated = vec3(orbPos.x * c - orbPos.z * s, orbPos.y, orbPos.x * s + orbPos.z * c);
    } else {
        // Floating: shimmer effect
        float shimmer = sin(uTime * 3.0 + aProgress * 50.0) * 0.05;
        rotated = orbPos * (1.0 + shimmer);
    }
    
    // Gentle breathing/pulse for all
    float pulse = 1.0 + sin(uTime * 1.5) * 0.03;
    
    // Size reduction based on pinch (shrinks as fingers get closer)
    float shrinkFactor = smoothstep(0.2, 0.7, uPinch);
    float minSize = 0.3;
    float orbScale = mix(minSize, 1.0, shrinkFactor);
    
    vec3 butterflyPos = rotated * pulse * orbScale;

    // 2. Target Magic Circle Position
    float t = uTime;
    float totalSegments = 6.0; // 6 segments including rotating orbs
    float ringID = floor(aProgress * totalSegments); 
    float segmentProgress = fract(aProgress * totalSegments);
    vRingID = ringID;

    float r = 0.0;
    float theta = 0.0;
    float z = 0.0;
    float sizeMult = 1.0;
    
    // --- Ring Logic ---
    if (ringID == 0.0) { // Ring 1: Multi-layered Hexagonal Core with Metatron's Cube elements
        float localP = segmentProgress;
        
        if (localP < 0.25) {
            // Innermost hexagon - rotates clockwise
            float hexP = localP / 0.25;
            float baseAngle = hexP * 6.28;
            float hexShape = 1.6 / cos(mod(baseAngle + 0.523, 1.047) - 0.523);
            r = hexShape;
            theta = baseAngle + t * 1.5; // Apply rotation to theta only
            sizeMult = 1.5;
            
            // Bright vertex markers
            float vertexPhase = mod(baseAngle + 0.523, 1.047);
            if (vertexPhase < 0.15 || vertexPhase > 0.9) {
                sizeMult = 2.5;
            }
        } else if (localP < 0.5) {
            // Second inner hexagon - rotates counter-clockwise (opposite to innermost)
            float hexP = (localP - 0.25) / 0.25;
            float baseAngle = hexP * 6.28;
            float hexShape = 2.4 / cos(mod(baseAngle + 0.523, 1.047) - 0.523);
            r = hexShape;
            theta = baseAngle - t * 1.5; // Apply rotation to theta only (opposite direction)
            sizeMult = 1.3;
            
            // Bright vertex markers
            float vertexPhase = mod(baseAngle + 0.523, 1.047);
            if (vertexPhase < 0.15 || vertexPhase > 0.9) {
                sizeMult = 2.2;
            }
        } else if (localP < 0.7) {
            // Middle circle with tick marks
            float circP = (localP - 0.5) / 0.2;
            float circAngle = circP * 6.28 + t * 0.5;
            r = 3.0;
            theta = circAngle;
            
            // 12 evenly spaced tick marks
            float tickPhase = mod(circAngle * 1.909, 1.0);
            if (tickPhase < 0.08) {
                r = 3.3;
                sizeMult = 1.4;
            }
        } else {
            // Outer hexagon - rotates clockwise (opposite to second inner)
            float hexP = (localP - 0.7) / 0.3;
            float baseAngle = hexP * 6.28;
            float hexShape = 3.6 / cos(mod(baseAngle + 0.523, 1.047) - 0.523);
            r = hexShape;
            theta = baseAngle + t * 1.2; // Apply rotation to theta only
            sizeMult = 1.0;
        }
    }
    else if (ringID == 1.0) { // Ring 2: Intricate Flower of Life with nested circles
        float localP = segmentProgress;
        
        if (localP < 0.5) {
            // Main flower pattern - 6 overlapping circles
            float flowerP = localP / 0.5;
            float numPetals = 6.0;
            float petalIdx = floor(flowerP * numPetals);
            float petalProgress = fract(flowerP * numPetals);
            
            float petalAngle = (petalIdx / numPetals) * 6.28 - t * 0.35;
            float petalR = 1.8;
            float circleR = 1.8;
            
            float localAngle = petalProgress * 6.28;
            vec2 petalCenter = vec2(cos(petalAngle), sin(petalAngle)) * petalR;
            vec2 pointOnPetal = petalCenter + vec2(cos(localAngle), sin(localAngle)) * circleR;
            
            r = length(pointOnPetal);
            theta = atan(pointOnPetal.y, pointOnPetal.x);
            sizeMult = 0.5;
        } else if (localP < 0.75) {
            // Secondary ring of 12 smaller circles
            float secP = (localP - 0.5) / 0.25;
            float numSmall = 12.0;
            float smallIdx = floor(secP * numSmall);
            float smallProgress = fract(secP * numSmall);
            
            float smallAngle = (smallIdx / numSmall) * 6.28 + t * 0.5;
            float smallR = 3.8;
            float circR = 0.6;
            
            float localAngle = smallProgress * 6.28;
            vec2 smallCenter = vec2(cos(smallAngle), sin(smallAngle)) * smallR;
            vec2 point = smallCenter + vec2(cos(localAngle), sin(localAngle)) * circR;
            
            r = length(point);
            theta = atan(point.y, point.x);
            sizeMult = 0.4;
        } else {
            // Connecting radial lines
            float lineP = (localP - 0.75) / 0.25;
            float numLines = 12.0;
            float lineIdx = floor(lineP * numLines);
            float lineProgress = fract(lineP * numLines);
            
            float lineAngle = (lineIdx / numLines) * 6.28 - t * 0.25;
            r = 1.5 + lineProgress * 2.8;
            theta = lineAngle;
            sizeMult = 0.3;
        }
    }
    else if (ringID == 2.0) { // Ring 3: Complex interlocking geometric shapes
        float localP = segmentProgress;
        
        if (localP < 0.3) {
            // Dual rotating squares forming star
            float sqP = localP / 0.3;
            float sqAngle = sqP * 6.28;
            float sq1Angle = sqAngle + t * 0.35;
            float sq2Angle = sqAngle - t * 0.35 + 0.7854;
            
            float r1 = 5.2 / cos(mod(sq1Angle + 0.7854, 1.5708) - 0.7854);
            float r2 = 5.2 / cos(mod(sq2Angle + 0.7854, 1.5708) - 0.7854);
            
            float whichSq = step(0.5, fract(sqP * 2.0));
            r = mix(r1, r2, whichSq);
            theta = mix(sq1Angle, sq2Angle, whichSq);
            sizeMult = 0.6;
        } else if (localP < 0.5) {
            // Inner rotating hexagram (6-pointed star)
            float starP = (localP - 0.3) / 0.2;
            float starAngle = starP * 6.28 - t * 0.55;
            
            // Two overlapping triangles
            float tri1R = 4.2 / cos(mod(starAngle + 0.523, 2.094) - 1.047);
            float tri2R = 4.2 / cos(mod(starAngle + 0.523 + 1.047, 2.094) - 1.047);
            
            float whichTri = step(0.5, fract(starP * 2.0));
            r = mix(tri1R, tri2R, whichTri);
            theta = starAngle;
            sizeMult = 0.55;
        } else if (localP < 0.75) {
            // Spirograph-like pattern
            float spiroP = (localP - 0.5) / 0.25;
            float bigR = 5.8;
            float smallR = 1.2;
            float ratio = 7.0;
            
            float spiroAngle = spiroP * 6.28 * 3.0 + t * 0.6;
            float x = (bigR - smallR) * cos(spiroAngle) + smallR * cos(spiroAngle * ratio);
            float y = (bigR - smallR) * sin(spiroAngle) + smallR * sin(spiroAngle * ratio);
            
            r = length(vec2(x, y)) * 0.75;
            theta = atan(y, x);
            sizeMult = 0.5;
        } else {
            // Outer circle with pointed sawtooth wave pattern
            float waveP = (localP - 0.75) / 0.25;
            float waveAngle = waveP * 6.28 + t * 0.15;
            float waves = 16.0;
            
            // Create pointed/sawtooth pattern instead of smooth sine
            float toothPhase = fract(waveAngle * waves / 6.28 + t * 0.3);
            float pointed = abs(toothPhase - 0.5) * 2.0; // Triangle wave (0 to 1 to 0)
            
            r = 5.8 + pointed * 0.6;
            theta = waveAngle;
            sizeMult = 0.5 + pointed * 0.4;
        }
    }
    else if (ringID == 3.0) { // Ring 4: Precision geometric with sacred math
        if (segmentProgress < 0.25) {
             // Outer dodecagon (12-sided) with intricate detail
             float localP = segmentProgress / 0.25;
             float dodAngle = localP * 6.28 + t * 0.15;
             float dodR = 8.0 / cos(mod(dodAngle + 0.2618, 0.5236) - 0.2618);
             r = dodR;
             theta = dodAngle;
             
             // Degree markers every 15 degrees (24 markers)
             float degMark = mod(dodAngle * 57.2958, 15.0);
             if (degMark < 1.5 || degMark > 13.5) {
                 r += 0.35;
                 sizeMult = 1.5;
             }
             // Major markers every 45 degrees
             float majorMark = mod(dodAngle * 57.2958, 45.0);
             if (majorMark < 2.0 || majorMark > 43.0) {
                 r += 0.2;
                 sizeMult = 2.0;
             }
        } else if (segmentProgress < 0.45) {
             // Rotating triangular grid
             vIsInnerCircle = 1.0;
             float localP = (segmentProgress - 0.25) / 0.2;
             float numTris = 6.0;
             float triIdx = floor(localP * numTris);
             float triProgress = fract(localP * numTris);
             
             float triBaseAngle = (triIdx / numTris) * 6.28 + t * 0.75;
             float triR = 1.6;
             float triSize = 0.7;
             
             float triVertexAngle = triProgress * 6.28;
             float triVertexR = triSize / cos(mod(triVertexAngle + 0.523, 2.094) - 1.047);
             
             vec2 triCenter = vec2(cos(triBaseAngle), sin(triBaseAngle)) * triR;
             vec2 triPoint = triCenter + vec2(cos(triVertexAngle + triBaseAngle), sin(triVertexAngle + triBaseAngle)) * triVertexR;
             
             r = length(triPoint);
             theta = atan(triPoint.y, triPoint.x);
             sizeMult = 0.5;
        } else if (segmentProgress < 0.65) {
             // Concentric arcs with gaps
             float localP = (segmentProgress - 0.45) / 0.2;
             float arcAngle = localP * 6.28 - t * 0.4;
             float arcIdx = floor(localP * 8.0);
             float arcProgress = fract(localP * 8.0);
             
             // Create arc gaps
             if (arcProgress > 0.15 && arcProgress < 0.85) {
                 r = 6.8 - mod(arcIdx, 3.0) * 0.4;
                 theta = arcAngle;
                 sizeMult = 0.6;
             } else {
                 r = 0.001; // Hide in gaps
             }
        } else if (segmentProgress < 0.8) {
             // Pi-based circle with digits visualization
             float localP = (segmentProgress - 0.65) / 0.15;
             float piAngle = localP * 6.28 + t * 0.35;
             r = 7.2;
             theta = piAngle;
             
             // Create pattern based on pi digits (3.14159...)
             float digitIdx = floor(localP * 20.0);
             float piDigits[10] = float[10](3.0, 1.0, 4.0, 1.0, 5.0, 9.0, 2.0, 6.0, 5.0, 3.0);
             int idx = int(mod(digitIdx, 10.0));
             float digit = piDigits[idx];
             
             r = 7.0 + digit * 0.08;
             sizeMult = 0.4 + digit * 0.1;
        } else {
             // Inner mandala pattern
             float localP = (segmentProgress - 0.8) / 0.2;
             float mandalaAngle = localP * 6.28 * 2.0 - t * 0.6;
             float mandalaR = 4.5 + 0.8 * sin(mandalaAngle * 8.0);
             mandalaR += 0.3 * sin(mandalaAngle * 16.0 + t);
             
             r = mandalaR;
             theta = localP * 6.28;
             sizeMult = 0.65;
        }
    }
    else if (ringID == 4.0) { // Ring 5: Golden ratio spiral with mathematical precision
        float localP = segmentProgress;
        
        if (localP < 0.6) {
            // Fibonacci spiral points
            float fibP = localP / 0.6;
            float fibIdx = fibP * 144.0; // Fibonacci number
            float goldenAngle = 2.39996322; // Exact golden angle
            
            theta = fibIdx * goldenAngle + t * 0.15;
            r = sqrt(fibIdx) * 0.55 + 2.0;
            
            // Pulsing based on position
            r += 0.15 * sin(fibIdx * 0.3 + t * 3.0);
            z = sin(fibIdx * 0.2 + t) * 2.0 * uMagic;
            sizeMult = 0.6 + 0.3 * sin(fibIdx * 0.4);
        } else if (localP < 0.8) {
            // Logarithmic spiral
            float spiralP = (localP - 0.6) / 0.2;
            float spiralAngle = spiralP * 6.28 * 2.0 + t * 0.3;
            float a = 0.5;
            float b = 0.15;
            float logR = a * exp(b * spiralAngle);
            
            r = 2.0 + mod(logR, 5.0);
            theta = spiralAngle;
            z = (hash(aProgress * 1.5) - 0.5) * 3.0 * uMagic;
            sizeMult = 0.7;
        } else {
            // Fermat spiral (parabolic)
            float fermatP = (localP - 0.8) / 0.2;
            float fermatIdx = fermatP * 50.0;
            float fermatAngle = sqrt(fermatIdx) * 2.5 - t * 0.5;
            
            r = sqrt(fermatIdx) * 0.9 + 3.0;
            r = mod(r - 3.0, 4.5) + 3.0;
            theta = fermatAngle;
            z = cos(fermatIdx * 0.3) * 1.5 * uMagic;
            sizeMult = 0.55;
        }
    }
    else { // Ring 6: 7 Rotating Orbs with free movement responding to palm rotation
        float numOrbs = 7.0;
        float orbIdx = floor(segmentProgress * numOrbs);
        float orbProgress = fract(segmentProgress * numOrbs);
        
        // Orbit radius and rotation
        float orbitR = 10.0; // Distance from center
        float baseAngle = (orbIdx / numOrbs) * 6.28318; // Evenly spaced
        
        // Each orb has unique phase and response to rotation
        float orbPhase = hash(orbIdx * 7.77) * 6.28;
        float orbInertia = 0.5 + hash(orbIdx * 3.33) * 0.5; // Different inertia per orb
        
        // Determine rotation direction: odd orbs go opposite direction
        float rotationDir = mod(orbIdx, 2.0) < 1.0 ? 1.0 : -1.0;
        
        // Free movement: orbs lag behind and catch up based on palm rotation
        // Base rotation from time + palm rotation influence
        float palmInfluence = uRotation * 2.0; // Palm rotation drives orb position
        float timeRotation = t * 0.35 * rotationDir; // Direction based on orb index
        
        // Each orb responds differently - some lead, some lag
        float orbLag = sin(orbIdx * 1.5 + t * 0.5) * 0.8 * rotationDir; // Oscillating lag
        float wobble = sin(t * 2.0 + orbIdx * 2.0) * 0.15; // Slight wobble
        
        // Combined rotation with free movement feel
        float dynamicAngle = baseAngle + timeRotation + palmInfluence * orbInertia * rotationDir + orbLag + wobble;
        
        // Radius varies slightly based on rotation speed (centrifugal effect)
        float rotationSpeed = abs(sin(t * 0.5 + palmInfluence * 0.3));
        float dynamicR = orbitR + rotationSpeed * 0.8 + sin(t * 1.5 + orbIdx) * 0.5;
        
        // Split orbProgress into trail (0-0.85) and orb body (0.85-1.0)
        float trailLength = 0.85;
        float isTrail = step(orbProgress, trailLength);
        
        // Trail position: 0 = tail, 1 = head (near orb)
        float trailPos = orbProgress / trailLength;
        float orbBodyPos = (orbProgress - trailLength) / (1.0 - trailLength);
        
        // Smooth trail intensity (1.0 at head, 0.0 at tail)
        vOrbTrail = mix(trailPos, 1.0, 1.0 - isTrail);
        
        // Trail follows the arc path behind the orb - longer trail when moving fast
        float trailArcLength = 1.2 + rotationSpeed * 0.5;
        float trailAngleOffset = mix((1.0 - trailPos) * trailArcLength, 0.0, 1.0 - isTrail) * rotationDir;
        float orbAngle = dynamicAngle - trailAngleOffset;
        
        // Trail width tapers from head to tail (flat ribbon effect)
        float trailWidth = mix(0.25 * trailPos * trailPos, 0.0, 1.0 - isTrail);
        
        // Distribute particles across the ribbon width (perpendicular to path)
        float ribbonOffset = (hash(orbProgress * 13.0 + orbIdx) - 0.5) * 2.0 * trailWidth;
        
        // Calculate position on the circular arc
        float currentR = dynamicR + ribbonOffset;
        
        // For the orb head - spherical distribution
        float orbSize = 0.6;
        vec3 orbOffset = vec3(0.0);
        if (isTrail < 0.5) { // This is the orb body
            float phi = orbBodyPos * 6.28318 * 3.0;
            float randSeed = orbBodyPos * 7.0 + orbIdx;
            float cosTheta2 = 1.0 - 2.0 * hash(randSeed);
            float sinTheta2 = sqrt(1.0 - cosTheta2 * cosTheta2);
            orbOffset = vec3(
                orbSize * sinTheta2 * cos(phi),
                orbSize * sinTheta2 * sin(phi),
                orbSize * cosTheta2
            );
        }
        
        // Final position - trail lies flat on the orbit plane (z = 0 for trail)
        vec3 orbCenter = vec3(currentR * cos(orbAngle), currentR * sin(orbAngle), 0.0);
        
        // Orbs bob up/down with more dynamic movement
        if (isTrail < 0.5) {
            orbCenter.z = sin(t * 2.0 + orbIdx * 1.2) * 0.6 + cos(palmInfluence + orbIdx) * 0.3;
        }
        
        vec3 finalOrbPos = orbCenter + orbOffset;
        r = length(finalOrbPos.xy);
        theta = atan(finalOrbPos.y, finalOrbPos.x);
        z = finalOrbPos.z;
        
        // Size: trail particles are consistent, orb pulses slightly
        float pulseSize = 1.0 + sin(t * 8.0 + orbIdx * 0.5) * 0.1;
        sizeMult = mix(0.8 + vOrbTrail * 0.4, 1.3 * pulseSize, 1.0 - isTrail);
    }
    
    vec3 magicPos = vec3(r * cos(theta), r * sin(theta), z);
    
    // 3. SMOOTH TRANSITION BLEND
    float easeMagic = smoothstep(0.0, 1.0, uMagic);

    float rot = easeMagic * 3.14; 
    float c = cos(rot);
    float s = sin(rot);
    vec3 rotatedButterfly = vec3(
        butterflyPos.x * c - butterflyPos.y * s,
        butterflyPos.x * s + butterflyPos.y * c,
        butterflyPos.z
    );
    
    float noiseAmp = sin(uMagic * 3.14159) * 2.5;
    vec3 noise = vec3(
        hash(aProgress * 10.0) - 0.5,
        hash(aProgress * 20.0) - 0.5,
        hash(aProgress * 30.0) - 0.5
    ) * noiseAmp;

    vec3 finalPos = mix(rotatedButterfly, magicPos, easeMagic);
    finalPos += noise;
    
    // 4. BLAST EFFECT - scatter particles outward and fall with gravity
    if (uBlast > 0.01) {
        float blastProgress = uBlast;
        // Slower, smoother easing - cubic ease out for natural deceleration
        float easeBlast = 1.0 - pow(1.0 - blastProgress, 3.0);
        
        // Each particle gets unique random direction for scatter
        float randAngle = hash(aProgress * 777.0) * 6.28318;
        float randSpeed = 0.8 + hash(aProgress * 333.0) * 2.5; // Wider speed range
        float randUpward = hash(aProgress * 555.0) * 1.2; // More initial upward spread
        
        // Scatter direction - wider spread across screen
        vec3 scatterDir = vec3(
            cos(randAngle) * randSpeed * 1.5, // Wider horizontal spread
            sin(randAngle) * randSpeed * 0.6 + randUpward, // Some upward bias
            (hash(aProgress * 999.0) - 0.5) * randSpeed * 0.8 // Depth variation
        );
        
        // Slower time progression for smoother animation
        float blastTime = blastProgress * 2.0; // Slower time scale
        
        // Apply scatter with smooth deceleration
        float decel = 1.0 - blastProgress * 0.5; // Gradual slowdown
        vec3 scatterOffset = scatterDir * blastTime * 12.0 * decel;
        
        // Gentler gravity - particles float then fall
        float gravity = 8.0; // Reduced gravity for slower fall
        float fallDelay = smoothstep(0.0, 0.3, blastProgress); // Delay before falling
        float fallOffset = gravity * blastTime * blastTime * fallDelay;
        
        // Combine scatter and gravity
        vec3 blastOffset = scatterOffset;
        blastOffset.y -= fallOffset; // Gravity pulls down gradually
        
        // Gentle tumble/spin
        float spin = blastTime * (hash(aProgress * 111.0) - 0.5) * 4.0; // Slower spin
        blastOffset.x += sin(spin) * 0.3;
        blastOffset.z += cos(spin) * 0.3;
        
        // Smooth blend between normal position and blast position
        finalPos = mix(finalPos, finalPos + blastOffset, easeBlast);
        
        // Gradual fade out - starts later, fades slower
        vBlastAlpha = 1.0 - smoothstep(0.4, 1.0, blastProgress);
    }

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size Attenuation
    gl_PointSize = uSize * (40.0 / -mvPosition.z);
    gl_PointSize *= mix(1.0, sizeMult, easeMagic);
    
    if (r < 0.1 && ringID > 0.0) gl_PointSize = 0.0;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uMagic;
  uniform float uBlast;
  
  varying float vProgress;
  varying float vMagic;
  varying float vVisible;
  varying float vRingID;
  varying float vIsInnerCircle;
  varying float vRandom;
  varying float vOrbTrail;
  varying float vBlastAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;
    
    float glow = 1.0 - (dist * 2.0);
    glow = pow(glow, 3.0); 
    
    // --- COLOR ---
    vec3 baseColor = uColor;
    vec3 magicColor = vec3(0.0, 1.0, 1.0); // Default cyan
    
    if (vRingID == 4.0) magicColor = vec3(0.6, 0.2, 1.0); // Sparks - Neon Purple
    if (vRingID == 5.0) magicColor = vec3(0.8, 0.0, 1.0); // Rotating Orbs - Bright Purple
    if (vRingID == 0.0) magicColor = vec3(0.0, 1.0, 0.9); // Inner - Cyan
    if (vRingID == 2.0) magicColor = vec3(0.5, 0.0, 1.0); // Shield - Purple
    if (vIsInnerCircle > 0.5) magicColor = vec3(0.7, 0.9, 1.0); // Pale Cyan

    vec3 finalRGB = mix(baseColor, magicColor, vMagic);
    // Hot Center
    finalRGB = mix(finalRGB, vec3(1.0), glow * 0.5 * vMagic);
    
    // Flash
    float flash = sin(vMagic * 3.14159);
    finalRGB += vec3(0.2, 0.0, 0.4) * flash * 0.5;
    
    // Standard Alpha
    float speed = 0.2;
    float headPos = fract(uTime * speed);
    float d = vProgress - headPos;
    if (d > 0.0) d -= 1.0;
    float trailIntensity = smoothstep(-0.65, 0.0, d);
    if (d > -0.02 && d <= 0.0) trailIntensity = 1.0; 
    
    float butterflyAlpha = (0.1 + trailIntensity * 0.9) * glow;
    float magicAlpha = glow;
    
    // Flicker for sparks
    if (vRingID == 4.0) magicAlpha *= 0.5 + 0.5 * sin(uTime * 10.0 + vProgress * 100.0);
    
    // Trail fade for rotating orbs
    if (vRingID == 5.0) {
        // Smooth gradient fade from head to tail
        float smoothFade = smoothstep(0.0, 1.0, vOrbTrail);
        magicAlpha *= smoothFade;
        
        // Solid color gradient: neon purple at head, deeper purple at tail
        vec3 headColor = vec3(0.9, 0.3, 1.0);  // Bright neon purple
        vec3 tailColor = vec3(0.4, 0.0, 0.8);  // Deep purple
        
        vec3 trailColor = mix(tailColor, headColor, vOrbTrail);
        finalRGB = trailColor;
    }

    float alpha = mix(butterflyAlpha, magicAlpha, vMagic);
    
    // Apply visibility (hide when hand not detected)
    alpha *= vVisible;
    
    // Apply blast fade out
    alpha *= vBlastAlpha;
    
    // During blast, add bright flash effect
    if (uBlast > 0.01 && vBlastAlpha > 0.5) {
        finalRGB = mix(finalRGB, vec3(1.0, 0.8, 1.0), uBlast * 0.3);
    }

    gl_FragColor = vec4(finalRGB, alpha);
  }
`;

const ButterflyCurve: React.FC<ButterflyCurveProps> = ({ params, handStateRef }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate curve points
  const { positions, progress } = useMemo(() => {
    const pts: number[] = [];
    const prog: number[] = [];
    
    const numPoints = 40000;
    const orbRadius = params.scale * 9.3;
    let idx = 0;
    
    // Structure 1: Icosahedron wireframe (20% of points)
    const icoPoints = Math.floor(numPoints * 0.2);
    const phi_ico = (1 + Math.sqrt(5)) / 2;
    const icoVertices = [
      [-1, phi_ico, 0], [1, phi_ico, 0], [-1, -phi_ico, 0], [1, -phi_ico, 0],
      [0, -1, phi_ico], [0, 1, phi_ico], [0, -1, -phi_ico], [0, 1, -phi_ico],
      [phi_ico, 0, -1], [phi_ico, 0, 1], [-phi_ico, 0, -1], [-phi_ico, 0, 1]
    ];
    const icoEdges = [
      [0,1],[0,5],[0,7],[0,10],[0,11],[1,5],[1,7],[1,8],[1,9],
      [2,3],[2,4],[2,6],[2,10],[2,11],[3,4],[3,6],[3,8],[3,9],
      [4,5],[4,9],[4,11],[5,9],[5,11],[6,7],[6,8],[6,10],[7,8],[7,10],
      [8,9],[10,11]
    ];
    const pointsPerEdge = Math.floor(icoPoints / icoEdges.length);
    for (let e = 0; e < icoEdges.length; e++) {
      const [v1, v2] = icoEdges[e];
      const start = icoVertices[v1];
      const end = icoVertices[v2];
      for (let i = 0; i < pointsPerEdge; i++) {
        const t = i / pointsPerEdge;
        const x = (start[0] + (end[0] - start[0]) * t) * orbRadius * 0.35;
        const y = (start[1] + (end[1] - start[1]) * t) * orbRadius * 0.35;
        const z = (start[2] + (end[2] - start[2]) * t) * orbRadius * 0.35;
        pts.push(x, y, z);
        prog.push(idx++ / numPoints);
      }
    }
    
    // Structure 2: Three intersecting rings (30% of points)
    const ringPoints = Math.floor(numPoints * 0.3);
    const pointsPerRing = Math.floor(ringPoints / 3);
    for (let ring = 0; ring < 3; ring++) {
      for (let i = 0; i < pointsPerRing; i++) {
        const theta = (i / pointsPerRing) * Math.PI * 2;
        const r = orbRadius * 0.9;
        let x, y, z;
        if (ring === 0) { // XY plane
          x = r * Math.cos(theta);
          y = r * Math.sin(theta);
          z = 0;
        } else if (ring === 1) { // XZ plane
          x = r * Math.cos(theta);
          y = 0;
          z = r * Math.sin(theta);
        } else { // YZ plane
          x = 0;
          y = r * Math.cos(theta);
          z = r * Math.sin(theta);
        }
        pts.push(x, y, z);
        prog.push(idx++ / numPoints);
      }
    }
    
    // Structure 3: Spiral latitude lines (30% of points)
    const spiralPoints = Math.floor(numPoints * 0.3);
    for (let i = 0; i < spiralPoints; i++) {
      const t = i / spiralPoints;
      const phi = t * Math.PI; // From pole to pole
      const theta = t * Math.PI * 12; // Multiple spirals
      const r = orbRadius * 0.85;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      pts.push(x, y, z);
      prog.push(idx++ / numPoints);
    }
    
    // Structure 4: Floating particles around surface (20% of points)
    const floatPoints = numPoints - idx;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < floatPoints; i++) {
      const t = i / floatPoints;
      const theta = 2 * Math.PI * i / goldenRatio;
      const phi = Math.acos(1 - 2 * t);
      const r = orbRadius * (0.95 + Math.random() * 0.1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      pts.push(x, y, z);
      prog.push(idx++ / numPoints);
    }
    
    return {
      positions: new Float32Array(pts),
      progress: new Float32Array(prog)
    };
  }, [params]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      materialRef.current.uniforms.uColor.value.set(params.color);
      
      let magicValue = 0;
      let rotation = 0;
      let blastTarget = 0;
      let pinchValue = 1.0; // Default to open (full size)
      let visibleTarget = 0.0; // Hidden by default
      
      if (handStateRef && handStateRef.current && handStateRef.current.detected) {
          visibleTarget = 1.0; // Show when hand detected
          const pinch = handStateRef.current.pinch;
          pinchValue = pinch;
          magicValue = THREE.MathUtils.smoothstep(pinch, 0.3, 0.8);
          rotation = handStateRef.current.rotation;
          blastTarget = handStateRef.current.blast || 0;
      }
      
      // Smooth visibility transition
      materialRef.current.uniforms.uVisible.value = THREE.MathUtils.lerp(
          materialRef.current.uniforms.uVisible.value,
          visibleTarget,
          0.1
      );
      
      // Smooth pinch for orb size
      materialRef.current.uniforms.uPinch.value = THREE.MathUtils.lerp(
          materialRef.current.uniforms.uPinch.value,
          pinchValue,
          0.12
      );
      
      // Smooth magic transition
      materialRef.current.uniforms.uMagic.value = THREE.MathUtils.lerp(
          materialRef.current.uniforms.uMagic.value,
          magicValue,
          0.08 
      );
      
      // Smooth rotation for orbs
      materialRef.current.uniforms.uRotation.value = THREE.MathUtils.lerp(
          materialRef.current.uniforms.uRotation.value,
          rotation,
          0.1
      );
      
      // Blast with smooth ramp up and faster recovery
      const currentBlast = materialRef.current.uniforms.uBlast.value;
      if (blastTarget > 0.5) {
          // Smooth ramp up when blast triggered
          materialRef.current.uniforms.uBlast.value = THREE.MathUtils.lerp(currentBlast, 1.0, 0.08);
      } else {
          // Faster decay to return to magic circle quickly
          materialRef.current.uniforms.uBlast.value = THREE.MathUtils.lerp(currentBlast, 0.0, 0.06);
      }
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aProgress"
          count={progress.length}
          array={progress}
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
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(params.color) },
          uSize: { value: 12.0 }, // Thicker lines for orb
          uMagic: { value: 0.0 },
          uPinch: { value: 1.0 }, // Finger distance for orb size
          uVisible: { value: 0.0 }, // Hidden by default until hand detected
          uRotation: { value: 0.0 },
          uBlast: { value: 0.0 },
          uBlastTime: { value: 0.0 }
        }}
      />
    </points>
  );
};

export default ButterflyCurve;