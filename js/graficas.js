// Gráfica SVG de la estructura de un JPEG por segmentos (se usa en /proceso/ con el ejemplo real).

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Agrupa segmentos JPEG consecutivos del mismo tipo (p. ej. 4 DHT → «DHT ×4»). */
export function agrupar(segmentos) {
  const out = [];
  for (const s of segmentos) {
    const corto = s.marca === -1 ? 'DATOS' : s.nombre.split(' · ')[0];
    const ult = out[out.length - 1];
    if (ult && ult.corto === corto) { ult.veces++; ult.largo += s.largo; continue; }
    out.push({ corto, nombre: s.nombre, inicio: s.inicio, largo: s.largo, veces: 1, marca: s.marca });
  }
  return out;
}

/**
 * Dos franjas: arriba bloques de igual ancho (para leer los nombres),
 * abajo la proporción real de bytes. `apendice` = bytes tras FFD9.
 */
export function svgSegmentos(segmentos, total, apendice = 0) {
  const grupos = agrupar(segmentos);
  if (apendice) grupos.push({ corto: 'APÉNDICE', nombre: 'datos pegados tras FFD9', inicio: total - apendice, largo: apendice, veces: 1, marca: -2 });
  const W = 900, x0 = 10, ancho = W - 20;
  const w = ancho / grupos.length;
  const color = (g) => (g.marca === -2 ? 'var(--rojo)' : g.marca === -1 ? 'var(--cian)' : g.marca === 0xd8 || g.marca === 0xd9 ? 'var(--tinta)' : 'var(--papel-2)');
  const texto = (g) => (g.marca === -2 || g.marca === 0xd8 || g.marca === 0xd9 ? 'var(--papel)' : 'var(--tinta)');
  let s = `<svg viewBox="0 0 ${W} 230" role="img" aria-labelledby="g-seg-t g-seg-d" class="grafica"><title id="g-seg-t">Estructura de un JPEG por segmentos</title><desc id="g-seg-d">${grupos.map((g) => `${g.corto}${g.veces > 1 ? ' ×' + g.veces : ''}: ${g.largo} bytes`).join('; ')}</desc>`;
  s += `<text x="${x0}" y="16" class="g-rot">Orden de los segmentos (mismo ancho para poder leerlos)</text>`;
  grupos.forEach((g, i) => {
    const x = x0 + i * w;
    s += `<rect x="${x.toFixed(1)}" y="26" width="${(w - 3).toFixed(1)}" height="70" fill="${color(g)}" stroke="var(--tinta)" stroke-width="2"/>`;
    s += `<text x="${(x + w / 2 - 1.5).toFixed(1)}" y="56" text-anchor="middle" class="g-seg" fill="${texto(g)}">${esc(g.corto)}${g.veces > 1 ? ' ×' + g.veces : ''}</text>`;
    s += `<text x="${(x + w / 2 - 1.5).toFixed(1)}" y="78" text-anchor="middle" class="g-num" fill="${texto(g)}">${g.largo.toLocaleString('es-CO')} B</text>`;
  });
  s += `<text x="${x0}" y="128" class="g-rot">Proporción real de bytes (${total.toLocaleString('es-CO')} B en total)</text>`;
  let x = x0;
  for (const g of grupos) {
    const ww = Math.max(1, (g.largo / total) * ancho);
    s += `<rect x="${x.toFixed(1)}" y="138" width="${ww.toFixed(1)}" height="34" fill="${color(g)}" stroke="var(--tinta)" stroke-width="1"/>`;
    x += ww;
  }
  s += `<text x="${x0}" y="196" class="g-nota">La cabecera (SOI a SOS) es diminuta; casi todo son datos comprimidos. El apéndice queda fuera de la imagen: ningún visor lo dibuja.</text>`;
  s += `<text x="${x0}" y="216" class="g-nota">B = bytes · calculado aquí con js/fin.js sobre ejemplos/sospechosa.jpg</text>`;
  return s + '</svg>';
}
