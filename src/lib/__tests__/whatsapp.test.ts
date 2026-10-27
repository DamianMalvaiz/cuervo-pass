import { urlWhatsapp } from '../whatsapp';

// El enlace que abre «Ver contacto». El prefijo 52 fija México (decisión de alcance declarada en el README y en docs/modelo-amenazas.md, AUD-17) y el texto lleva el título de la publicación, bien codificado.

describe('urlWhatsapp', () => {
  it('antepone el 52 de México y deja solo los dígitos del número', () => {
    expect(urlWhatsapp('722 123-4567', 'Cuarto')).toMatch(/^https:\/\/wa\.me\/527221234567\?text=/);
    expect(urlWhatsapp('(722) 123 45 67', 'Cuarto')).toMatch(/^https:\/\/wa\.me\/527221234567\?text=/);
  });

  it('el mensaje nombra la publicación y va codificado para URL', () => {
    const url = urlWhatsapp('7221234567', 'Casa "Los Pinos" & jardín');
    const texto = decodeURIComponent(url.split('?text=')[1]);
    expect(texto).toBe('Hola, vi tu publicación "Casa "Los Pinos" & jardín" en Cuervo 360 y me interesa.');
    expect(url).not.toContain(' ');
    expect(url.split('?text=')[1]).not.toContain('&');
  });
});
