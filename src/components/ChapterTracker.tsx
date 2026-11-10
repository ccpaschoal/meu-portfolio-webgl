import React from 'react';
import type { ChapterTrackerProps } from '../types/portfolio';

const CHAPTERS = [
  { num: '00', label: 'MATRIZ' },
  { num: '01', label: 'DIGITAL' },
  { num: '02', label: 'ESPIRAL' },
  { num: '03', label: 'CONTATO' }
];

export const ChapterTracker: React.FC<ChapterTrackerProps> = ({
  activeChapter,
  onSelectChapter
}) => {
  return (
    <nav id="chapter-tracker" className="chapter-tracker" aria-label="Progresso de capítulos">
      <div className="tracker-rail">
        <div className="tracker-indicator" id="tracker-indicator" />
      </div>
      <ul className="tracker-list">
        {CHAPTERS.map((chap, idx) => {
          const isActive = activeChapter === idx;
          return (
            <li
              key={chap.num}
              data-chapter={idx}
              className={isActive ? 'active' : ''}
            >
              <button
                type="button"
                className="tracker-button"
                aria-label={`${chap.num} ${chap.label}`}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => onSelectChapter(idx)}
              >
                <span className="tracker-num">{chap.num}</span>
                <span className="tracker-label">{chap.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
