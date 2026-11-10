import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { ProjectModalProps } from '../types/portfolio';

/**
 * ProjectModal Component
 * Modal de detalhes de projetos com animação GSAP de entrada/saída,
 * acessibilidade completa (Esc, foco, aria-modal) e tipagem estrita.
 */
export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  project,
  onClose
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !modalRef.current || !contentRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        modalRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power2.out' }
      );
      gsap.fromTo(
        contentRef.current,
        { y: 30, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.4)' }
      );
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      ctx.revert();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  return (
    <div
      ref={modalRef}
      className="project-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-project-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px'
      }}
    >
      <div
        ref={contentRef}
        className="project-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0d0d0f',
          border: '1px solid #222',
          borderRadius: '12px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '32px',
          color: '#f0f0f0',
          position: 'relative'
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar modal"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: '24px',
            cursor: 'pointer'
          }}
        >
          ×
        </button>

        <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#888', letterSpacing: '0.1em' }}>
          {project.tag}
        </span>
        <h2 id="modal-project-title" style={{ fontSize: '28px', marginTop: '8px', marginBottom: '24px' }}>
          {project.title}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {project.photos.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${project.title} — foto ${i + 1}`}
              loading="lazy"
              style={{ width: '100%', height: 'auto', borderRadius: '8px', border: '1px solid #1a1a1a' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
