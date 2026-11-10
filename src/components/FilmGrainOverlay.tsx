import React from 'react';

/**
 * FilmGrainOverlay Component
 * Camada óptica com vinheta cinematográfica de lente e shader analógico de grão (film grain)
 * que unifica a textura visual do 35mm e do VHS sem degradar a performance do WebGL.
 */
export const FilmGrainOverlay: React.FC = () => {
  return <div className="film-grain-overlay" aria-hidden="true" />;
};
