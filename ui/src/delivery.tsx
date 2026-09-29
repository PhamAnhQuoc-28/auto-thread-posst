import React from 'react';
import { createRoot } from 'react-dom/client';
import DeliveryApp from './DeliveryApp';
import './delivery.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><DeliveryApp /></React.StrictMode>
);
