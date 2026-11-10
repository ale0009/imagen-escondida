// ¿Dónde termina DE VERDAD el archivo? Se recorre la estructura del formato
// (no se busca "el primer FFD9" a ciegas: una miniatura EXIF también trae su FFD9).
//
// Todas devuelven { fin, marcador: {inicio, largo} | null, nota } o { fin: null, motivo }.
// `fin` = posición del primer byte que ya NO pertenece al archivo.

const leer16be = (b, i) => (b[i] << 8) | b[i + 1];
const leer32be = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const leer16le = (b, i) => b[i] | (b[i + 1] << 8);
const leer32le = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/** Nombres de los marcadores JPEG más comunes (ITU-T T.81). */
export function nombreMarcador(m) {
  if (m === 0xd8) return 'SOI · inicio de imagen';
  if (m === 0xd9) return 'EOI · fin de imagen';
  if (m === 0xda) return 'SOS · inicio de datos';
  if (m === 0xdb) return 'DQT · tablas de cuantización';
  if (m === 0xc4) return 'DHT · tablas de Huffman';
  if (m === 0xdd) return 'DRI · intervalo de reinicio';
  if (m === 0xfe) return 'COM · comentario';
  if (m === 0xc0) return 'SOF0 · cuadro (básico)';
  if (m === 0xc2) return 'SOF2 · cuadro (progresivo)';
  if (m >= 0xc1 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return `SOF${m - 0xc0} · cuadro`;
  if (m >= 0xe0 && m <= 0xef) return m === 0xe1 ? 'APP1 · EXIF / XMP' : m === 0xe0 ? 'APP0 · JFIF' : `APP${m - 0xe0} · aplicación`;
  if (m >= 0xd0 && m <= 0xd7) return `RST${m - 0xd0} · reinicio`;
  return `FF${m.toString(16).toUpperCase().padStart(2, '0')}`;
}

/**
 * Recorre un JPEG segmento a segmento.
 * Devuelve { segmentos: [{marca, nombre, inicio, largo}], fin, error }.
 * Los datos comprimidos tras SOS aparecen como un segmento 'datos' propio.
 */
export function segmentosJpeg(b) {
  const segmentos = [];
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return { segmentos, fin: null, error: 'No empieza con FFD8 (SOI).' };
  segmentos.push({ marca: 0xd8, nombre: nombreMarcador(0xd8), inicio: 0, largo: 2 });
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return { segmentos, fin: null, error: `Byte inesperado ${b[i].toString(16).toUpperCase()} en la posición ${i}: estructura rota.` };
    // Bytes de relleno FF FF … antes de un marcador están permitidos.
    let j = i;
    while (j < b.length && b[j] === 0xff) j++;
    if (j >= b.length) break;
    const m = b[j];
    const inicio = j - 1;
    if (m === 0xd9) {
      segmentos.push({ marca: m, nombre: nombreMarcador(m), inicio, largo: 2 });
      return { segmentos, fin: inicio + 2, error: null };
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { // marcadores sin longitud
      segmentos.push({ marca: m, nombre: nombreMarcador(m), inicio, largo: 2 });
      i = j + 1;
      continue;
    }
    if (j + 2 >= b.length) break;
    const largo = leer16be(b, j + 1);
    if (largo < 2) return { segmentos, fin: null, error: `Segmento ${nombreMarcador(m)} con longitud inválida (${largo}).` };
    const finSeg = j + 1 + largo;
    if (finSeg > b.length) {
      segmentos.push({ marca: m, nombre: nombreMarcador(m), inicio, largo: b.length - inicio });
      break;
    }
    segmentos.push({ marca: m, nombre: nombreMarcador(m), inicio, largo: finSeg - inicio });
    i = finSeg;
    if (m === 0xda) {
      // Datos comprimidos: termina en el primer FF seguido de algo que no sea 00 (relleno) ni RST.
      let k = i;
      while (k < b.length - 1) {
        if (b[k] === 0xff) {
          const s = b[k + 1];
          if (s === 0x00 || (s >= 0xd0 && s <= 0xd7)) { k += 2; continue; }
          if (s === 0xff) { k += 1; continue; }
          break;
        }
        k++;
      }
      if (k >= b.length - 1) {
        segmentos.push({ marca: -1, nombre: 'datos comprimidos (sin final)', inicio: i, largo: b.length - i });
        return { segmentos, fin: null, error: 'Los datos comprimidos llegan al final sin marcador EOI (FFD9): archivo truncado.' };
      }
      segmentos.push({ marca: -1, nombre: 'datos comprimidos de la imagen', inicio: i, largo: k - i });
      i = k;
    }
  }
  return { segmentos, fin: null, error: 'No apareció el marcador EOI (FFD9): archivo truncado.' };
}

export function finJpeg(b) {
  const r = segmentosJpeg(b);
  if (r.fin === null) return { fin: null, motivo: r.error };
  return { fin: r.fin, marcador: { inicio: r.fin - 2, largo: 2 }, nota: 'Marcador EOI FF D9 encontrado recorriendo los segmentos.' };
}

/** PNG: firma de 8 bytes y luego bloques [longitud 4][tipo 4][datos][CRC 4] hasta IEND. */
export function bloquesPng(b) {
  const bloques = [];
  if (b.length < 8 || b[0] !== 0x89 || b[1] !== 0x50) return { bloques, fin: null, error: 'No es un PNG.' };
  let i = 8;
  while (i + 12 <= b.length) {
    const largo = leer32be(b, i);
    const tipo = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (!/^[A-Za-z]{4}$/.test(tipo)) return { bloques, fin: null, error: `Bloque con nombre inválido en la posición ${i}: estructura rota.` };
    const finBloque = i + 12 + largo;
    if (finBloque > b.length) return { bloques, fin: null, error: `El bloque ${tipo} dice medir ${largo} bytes pero el archivo se acaba antes: truncado.` };
    bloques.push({ tipo, inicio: i, largo: 12 + largo });
    if (tipo === 'IEND') return { bloques, fin: finBloque, error: null };
    i = finBloque;
  }
  return { bloques, fin: null, error: 'No apareció el bloque IEND: archivo truncado.' };
}

export function finPng(b) {
  const r = bloquesPng(b);
  if (r.fin === null) return { fin: null, motivo: r.error };
  // El marcador visible es "IEND" + CRC (AE 42 60 82), los 8 bytes finales del bloque.
  return { fin: r.fin, marcador: { inicio: r.fin - 8, largo: 8 }, nota: 'Bloque IEND (49 45 4E 44 + CRC) encontrado recorriendo los bloques.' };
}

/** GIF: cabecera, paleta, bloques de imagen/extensión con sub-bloques, y el byte final 3B. */
export function finGif(b) {
  if (b.length < 13) return { fin: null, motivo: 'GIF demasiado corto.' };
  let i = 13;
  const banderas = b[10];
  if (banderas & 0x80) i += 3 * (1 << ((banderas & 0x07) + 1));
  const saltarSubbloques = (k) => {
    while (k < b.length) {
      const n = b[k];
      k += 1;
      if (n === 0) return k;
      k += n;
    }
    return -1;
  };
  while (i < b.length) {
    const t = b[i];
    if (t === 0x3b) return { fin: i + 1, marcador: { inicio: i, largo: 1 }, nota: 'Byte final 3B (trailer) encontrado recorriendo los bloques.' };
    if (t === 0x21) {
      const k = saltarSubbloques(i + 2);
      if (k < 0) break;
      i = k;
    } else if (t === 0x2c) {
      if (i + 10 > b.length) break;
      let k = i + 10;
      const fl = b[i + 9];
      if (fl & 0x80) k += 3 * (1 << ((fl & 0x07) + 1));
      k += 1; // tamaño mínimo LZW
      k = saltarSubbloques(k);
      if (k < 0) break;
      i = k;
    } else {
      return { fin: null, motivo: `Bloque desconocido ${t.toString(16).toUpperCase()} en la posición ${i}: estructura rota.` };
    }
  }
  return { fin: null, motivo: 'No apareció el byte final 3B: archivo truncado.' };
}

/** PDF: el ÚLTIMO %%EOF (las ediciones incrementales añaden más de uno) y su salto de línea. */
export function finPdf(b) {
  const pat = [0x25, 0x25, 0x45, 0x4f, 0x46];
  for (let i = b.length - pat.length; i >= 0; i--) {
    let ok = true;
    for (let k = 0; k < pat.length; k++) if (b[i + k] !== pat[k]) { ok = false; break; }
    if (ok) {
      let fin = i + pat.length;
      if (b[fin] === 0x0d) fin++;
      if (b[fin] === 0x0a) fin++;
      return { fin, marcador: { inicio: i, largo: pat.length }, nota: 'Último %%EOF del documento.' };
    }
  }
  return { fin: null, motivo: 'No apareció %%EOF: PDF truncado o dañado.' };
}

/** ZIP: el registro de fin de directorio (50 4B 05 06), 22 bytes + comentario. Se busca desde atrás. */
export function buscarEocd(b, desde = 0) {
  for (let i = b.length - 22; i >= desde; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) {
      const comentario = leer16le(b, i + 20);
      if (i + 22 + comentario <= b.length) return i;
    }
  }
  return -1;
}

export function finZip(b) {
  const i = buscarEocd(b);
  if (i < 0) return { fin: null, motivo: 'No apareció el fin de directorio ZIP (50 4B 05 06).' };
  return { fin: i + 22 + leer16le(b, i + 20), marcador: { inicio: i, largo: 22 }, nota: 'Registro de fin de directorio ZIP (50 4B 05 06).' };
}

/** BMP y RIFF/WebP declaran su tamaño en la cabecera. */
export function finBmp(b) {
  if (b.length < 6) return { fin: null, motivo: 'BMP demasiado corto.' };
  const t = leer32le(b, 2);
  if (t < 14 || t > b.length) return { fin: null, motivo: `La cabecera dice ${t} bytes y el archivo tiene ${b.length}: no cuadra.` };
  return { fin: t, marcador: { inicio: 2, largo: 4 }, nota: 'Tamaño declarado en la cabecera BMP.' };
}

export function finRiff(b) {
  if (b.length < 8) return { fin: null, motivo: 'RIFF demasiado corto.' };
  const t = leer32le(b, 4) + 8;
  if (t > b.length) return { fin: null, motivo: `La cabecera dice ${t} bytes y el archivo tiene ${b.length}: truncado.` };
  return { fin: Math.min(b.length, t + (t % 2)), marcador: { inicio: 4, largo: 4 }, nota: 'Tamaño declarado en la cabecera RIFF.' };
}

const BUSCADORES = { jpg: finJpeg, png: finPng, gif: finGif, pdf: finPdf, zip: finZip, 'zip-vacio': finZip, bmp: finBmp, webp: finRiff };

/** Busca el fin según el tipo detectado por la firma. */
export function buscarFin(b, tipo) {
  const f = BUSCADORES[tipo];
  if (!f) return { fin: null, motivo: 'Para este formato la herramienta no sabe dónde termina: no se buscan datos añadidos.', soportado: false };
  return { ...f(b), soportado: true };
}
