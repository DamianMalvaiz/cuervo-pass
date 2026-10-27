import type { ReactNode } from 'react';

export function Estado({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <main className="centrado">
      <div className="tarjeta estado">
        <h1>{titulo}</h1>
        {children}
      </div>
    </main>
  );
}
