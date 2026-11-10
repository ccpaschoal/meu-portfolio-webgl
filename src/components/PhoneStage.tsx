import React from 'react';
import type { PhoneStageProps } from '../types/portfolio';

export const PhoneStage: React.FC<PhoneStageProps> = ({
  currentSite,
  currentIndex,
  totalSites,
  onPrev,
  onNext
}) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const captionText = `${pad(currentIndex + 1)} / ${pad(totalSites)} · ${currentSite.title}`;

  return (
    <section id="phone-stage" className="phone-stage" aria-label="Sites no celular">
      <div className="phone-copy phone-copy-left">
        <span className="phone-headline">ADAPTÁVEL.</span>
        <span className="phone-subcopy">VAMOS DESCOBRIR</span>
      </div>
      <div className="phone-copy phone-copy-right">
        <span className="phone-headline">DO SEU JEITO.</span>
        <span className="phone-subcopy">O QUE MAIS COMBINA COM VOCÊ?</span>
      </div>
      <button
        type="button"
        id="site-prev"
        className="site-arrow site-arrow-prev"
        aria-label="Site anterior"
        onClick={onPrev}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m14 5-7 7 7 7" />
        </svg>
      </button>
      <button
        type="button"
        id="site-next"
        className="site-arrow site-arrow-next"
        aria-label="Próximo site"
        onClick={onNext}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m10 5 7 7-7 7" />
        </svg>
      </button>
      <p id="site-caption" className="site-caption" aria-live="polite">
        {captionText}
      </p>
    </section>
  );
};
