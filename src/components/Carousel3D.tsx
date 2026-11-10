import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import type { Carousel3DProps } from '../types/portfolio';

/**
 * Carousel3D Component
 * Gerencia malhas e texturas do carrossel no espaço Three.js com animações GSAP e
 * garantia estrita de .dispose() em texturas, geometrias e materiais no unmount do React.
 */
export const Carousel3D: React.FC<Carousel3DProps> = ({
  projects,
  activeProject,
  onSelectProject,
  visible = true
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const texturesRef = useRef<THREE.Texture[]>([]);
  const geometriesRef = useRef<THREE.BufferGeometry[]>([]);
  const materialsRef = useRef<THREE.Material[]>([]);

  useEffect(() => {
    const group = new THREE.Group();
    groupRef.current = group;

    const textureLoader = new THREE.TextureLoader();

    // Criação de malhas 3D para cada projeto com tipagem estrita
    projects.forEach((proj, idx) => {
      const geo = new THREE.PlaneGeometry(320, 400);
      geometriesRef.current.push(geo);

      const tex = proj.thumb ? textureLoader.load(proj.thumb) : null;
      if (tex) texturesRef.current.push(tex);

      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0xffffff,
        roughness: 0.25,
        metalness: 0.1,
        transparent: true,
        opacity: visible ? 1 : 0
      });
      materialsRef.current.push(mat);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((idx - projects.length / 2) * 360, 0, 0);
      mesh.userData = { project: proj, index: idx };
      group.add(mesh);
    });

    // Animação de entrada suave via GSAP com tipagem estrita
    const ctx = gsap.context(() => {
      if (groupRef.current) {
        gsap.to(groupRef.current.position, {
          z: 0,
          duration: 1.2,
          ease: 'power3.out'
        });
      }
    });

    // Cleanup completo no unmount do React
    return () => {
      ctx.revert();

      geometriesRef.current.forEach((g) => g.dispose());
      geometriesRef.current = [];

      texturesRef.current.forEach((t) => t.dispose());
      texturesRef.current = [];

      materialsRef.current.forEach((m) => m.dispose());
      materialsRef.current = [];

      if (groupRef.current) {
        groupRef.current.clear();
        groupRef.current = null;
      }
    };
  }, [projects, visible]);

  return null;
};
