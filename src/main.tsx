import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { PortfolioApp } from './components/PortfolioApp';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<PortfolioApp />);
}
