import React from 'react';
import type { IntroTeaserProps } from '../types/portfolio';

export const IntroTeaser: React.FC<IntroTeaserProps> = ({
  visible,
  onEnter
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <div
      id="intro-teaser"
      className="intro-teaser"
      role="button"
      aria-label="Entrar no portfólio"
      tabIndex={visible ? 0 : -1}
      // Escondido: sai da ordem de foco e da árvore de acessibilidade
      inert={!visible}
      onClick={onEnter}
      onKeyDown={handleKeyDown}
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.6s ease'
      }}
    >
      <div className="teaser-arrow">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="3" x2="12" y2="21" />
          <polyline points="19 14 12 21 5 14" />
        </svg>
      </div>
      <span className="teaser-hint">CLIQUE OU ROLE</span>
    </div>
  );
};
