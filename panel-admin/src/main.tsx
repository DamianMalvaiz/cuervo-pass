import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { crearClienteReal } from './lib/cliente';
import './estilos.css';

const raiz = document.getElementById('root')!;

// Sin configuración no se arranca a medias: se dice.
let cliente;
try {
  cliente = crearClienteReal();
} catch (e) {
  raiz.textContent = e instanceof Error ? e.message : 'No se pudo iniciar el panel.';
  throw e;
}

createRoot(raiz).render(
  <StrictMode>
    <App cliente={cliente} />
  </StrictMode>,
);
