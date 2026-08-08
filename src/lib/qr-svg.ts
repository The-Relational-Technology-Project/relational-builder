import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QRCode from 'react-qr-code';

/**
 * A QR code as an SVG markup string — for baking into generated HTML (the
 * Share Live deck, the printable room key) rather than rendering in the app.
 * Same library as the on-screen codes, so they scan identically.
 */
export function qrSvgMarkup(value: string, size = 256): string {
  return renderToStaticMarkup(
    createElement(QRCode, {
      value,
      size,
      bgColor: '#ffffff',
      fgColor: '#1c1917',
    }),
  );
}
