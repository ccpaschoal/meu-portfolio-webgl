import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { DustParticlesProps } from '../types/portfolio';

/**
 * DustParticles Component
 * Gerencia o sistema volumétrico dual-tone de partículas Three.js com tipagem estrita
 * e ciclo de vida seguro com .dispose() no unmount do React.
 */
export const DustParticles: React.FC<DustParticlesProps> = ({
  count = 6500,
  influenceRadius = 75.0,
  onInit,
  onDestroy
}) => {
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  useEffect(() => {
    // 1. Criação da Geometria e Atributos Tipados
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colorTypes = new Float32Array(count);
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 2000;
      positions[i3 + 1] = (Math.random() - 0.5) * 1200;
      positions[i3 + 2] = (Math.random() - 0.5) * 800;

      // 0.0 = âmbar/quente, 1.0 = prata/frio
      colorTypes[i] = Math.random() > 0.45 ? 1.0 : 0.0;
      scales[i] = Math.random() * 0.8 + 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColorType', new THREE.BufferAttribute(colorTypes, 1));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometryRef.current = geometry;

    // 2. Criação do ShaderMaterial tipado
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector3(99999, 99999, 0) },
        uInfluenceRadius: { value: influenceRadius },
        uColorWarm: { value: new THREE.Color(0xd4af37) },
        uColorCold: { value: new THREE.Color(0xb0c4de) },
        uWind: { value: 0.0 },
        uOpacity: { value: 1.0 }
      },
      vertexShader: `
        attribute float aColorType;
        attribute float aScale;
        uniform vec3 uMouse;
        uniform float uInfluenceRadius;
        uniform float uTime;
        uniform float uWind;
        uniform float uOpacity;
        varying float vColorType;
        varying float vAlpha;

        void main() {
          vColorType = aColorType;
          vec3 pos = position;

          // Vento ascendente
          float pSeed = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          float windLift = uWind * (1450.0 + pSeed * 950.0);
          float windSway = sin(uTime * 3.0 + pos.y * 0.008 + pSeed * 6.28) * (uWind * 160.0);
          pos.y += windLift;
          pos.x += windSway;

          float dist = distance(pos.xy, uMouse.xy);
          if (dist < uInfluenceRadius && uMouse.x < 50000.0) {
            vec2 dir = normalize(pos.xy - uMouse.xy);
            float force = (1.0 - dist / uInfluenceRadius);
            pos.xy += dir * force * 18.0;
          }
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float windSizeMult = mix(1.0, 0.4 + pSeed * 0.6, uWind);
          gl_PointSize = (2.2 * aScale * windSizeMult) * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          float baseAlpha = smoothstep(600.0, 100.0, -mvPosition.z);
          float particleLife = clamp(1.0 - uWind * (0.85 + pSeed * 0.45), 0.0, 1.0);
          vAlpha = baseAlpha * uOpacity * particleLife;
        }
      `,
      fragmentShader: `
        uniform vec3 uColorWarm;
        uniform vec3 uColorCold;
        varying float vColorType;
        varying float vAlpha;

        void main() {
          if (vAlpha <= 0.001) discard;
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          vec3 col = mix(uColorWarm, uColorCold, vColorType);
          float strength = 1.0 - smoothstep(0.0, 0.5, d);
          float finalA = strength * 0.65 * vAlpha;
          if (finalA <= 0.001) discard;
          gl_FragColor = vec4(col, finalA);
        }
      `
    });
    materialRef.current = material;

    const points = new THREE.Points(geometry, material);
    pointsRef.current = points;

    if (onInit) {
      onInit(points, geometry, material);
    }

    // 3. Ciclo de Desmontagem Seguro com .dispose()
    return () => {
      if (onDestroy) onDestroy();

      if (geometryRef.current) {
        geometryRef.current.dispose();
        geometryRef.current = null;
      }
      if (materialRef.current) {
        materialRef.current.dispose();
        materialRef.current = null;
      }
      pointsRef.current = null;
    };
  }, [count, influenceRadius, onInit, onDestroy]);

  return null;
};
