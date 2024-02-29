import React from 'react';
import { createRoot } from 'react-dom/client';
import Appl from './App';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <Appl />
  </React.StrictMode>
);