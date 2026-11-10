// Página /proceso/: mide los ejemplos reales y dibuja la estructura del JPG.

import { iniciarTema } from './tema.js';
import { segmentosJpeg } from './fin.js';
import { svgSegmentos } from './graficas.js';
import { analizar } from './analizar.js';

iniciarTema(document.getElementById('tema'));

const n = (x) => x.toLocaleString('es-CO');

async function leer(nombre) {
  const r = await fetch(`../ejemplos/${nombre}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

(async () => {
  const caja = document.getElementById('g-segmentos');
  const cifras = document.getElementById('cifras-ejemplo');
  try {
    const [jpg, png] = await Promise.all([leer('sospechosa.jpg'), leer('limpia.png')]);
    const seg = segmentosJpeg(jpg);
    caja.innerHTML = svgSegmentos(seg.segmentos, jpg.length, jpg.length - seg.fin);
    const a = analizar(jpg, 'sospechosa.jpg');
    const b = analizar(png, 'limpia.png');
    const datos = seg.segmentos.find((s) => s.marca === -1);
    cifras.textContent = `sospechosa.jpg pesa ${n(jpg.length)} bytes: la imagen termina en el byte ${n(seg.fin)} (FF D9) `
      + `y después vienen ${n(jpg.length - seg.fin)} bytes de un ZIP; los datos comprimidos de la imagen ocupan ${n(datos.largo)} bytes `
      + `(${((datos.largo / jpg.length) * 100).toFixed(1)} % del archivo). Veredicto: ${a.veredicto.toUpperCase()}, ${a.puntos} puntos. `
      + `limpia.png pesa ${n(png.length)} bytes y termina justo en IEND: veredicto ${b.veredicto.toUpperCase()}, ${b.puntos} puntos.`;
    cifras.classList.remove('tenue');
  } catch (e) {
    const msg = `No se pudieron leer los ejemplos (${e.message}). Abre la página desde un servidor.`;
    caja.textContent = msg;
    cifras.textContent = msg;
  }
})();
