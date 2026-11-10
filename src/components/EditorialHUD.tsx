import React, { useState, useEffect } from 'react';

export interface EditorialHUDProps {
  visible: boolean;
  currentProgress: number;
  activeChapter: number;
}

const CHAPTER_NAMES = [
  '00 // MATRIZ',
  '01 // PELÍCULA',
  '02 // DIGITAL',
  '03 // ARQUIVO'
];

/**
 * EditorialHUD Component
 * HUD cinematográfico editorial no padrão Awwwards com relógio de estúdio ao vivo,
 * status profissional, contador analógico de fita (Tape Counter) e metadados contextuais.
 */
export const EditorialHUD: React.FC<EditorialHUDProps> = ({
  visible,
  currentProgress,
  activeChapter
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatted = now.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit'
        });
        setTimeStr(formatted);
      } catch {
        setTimeStr('10:45');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Conversão de progresso 0.00-1.00 para minutagem analógica de fita (00:00 a 01:40)
  const totalSeconds = Math.round(currentProgress * 100);
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  const tapeCounter = `${mins}:${secs} / 01:40`;

  return (
    <header
      id="editorial-hud"
      className="editorial-hud"
      aria-hidden="true"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Barra Superior */}
      <div className="hud-top-bar">
        <div className="hud-brand">
          <span className="hud-title">CAMILLA PASCHOAL</span>
          <span className="hud-sep">//</span>
          <span className="hud-role">CREATIVE DEV & DESIGN</span>
        </div>

        <div className="hud-meta">
          <span className="hud-live-pill">
            <span className="hud-pulse-dot" />
            DISPONÍVEL PARA PROJETOS
          </span>
          <span className="hud-clock">
            RIO DE JANEIRO · {timeStr} BRT
          </span>
        </div>
      </div>

      {/* Barra Inferior / Contador Analógico */}
      <div className="hud-bottom-bar">
        <div className="hud-tape-status">
          <span className="hud-tape-label">TAPE COUNTER</span>
          <span className="hud-tape-digits">{tapeCounter}</span>
          <span className="hud-tape-chapter">{CHAPTER_NAMES[activeChapter] || CHAPTER_NAMES[0]}</span>
        </div>

        <div className="hud-nav-hints">
          <span className="hud-hint-key">[↑ ↓] ATOS</span>
          <span className="hud-hint-key">[SCROLL] NARRATIVA</span>
        </div>
      </div>
    </header>
  );
};
