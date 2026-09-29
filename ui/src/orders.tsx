import React from 'react';
import { createRoot } from 'react-dom/client';
import OrdersApp from './OrdersApp';
import './orders.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OrdersApp />
  </React.StrictMode>
);
