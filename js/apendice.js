// El «apéndice»: los bytes que quedan DESPUÉS del fin legítimo del archivo.
// Un visor de imágenes los ignora; un analista forense los quiere ver.

import { detectarTipo } from './firmas.js';
import { buscarEocd } from './fin.js';

const leer16le = (b, i) => b[i] | (b[i + 1] << 8);
const leer32le = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/** Bytes después de `fin` (copia, para poder descargarlos aparte). */
export function extraerApendice(bytes, fin) {
  if (fin === null || fin === undefined || fin >= bytes.length) return new Uint8Array(0);
  return bytes.slice(fin);
}

/** ¿Solo ceros, espacios o FF? Algunas cámaras y editores rellenan así: no es sospechoso. */
export function esRelleno(b) {
  if (!b.length) return false;
  for (const x of b) if (x !== 0x00 && x !== 0x20 && x !== 0x0a && x !== 0x0d && x !== 0x09 && x !== 0xff) return false;
  return true;
}

/** ¿Es texto legible? UTF-8 válido y al menos 90 % de caracteres imprimibles. */
export function esTexto(b) {
  if (!b.length) return false;
  let texto;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return false;
  }
  const chars = [...texto];
  let imprimibles = 0;
  for (const ch of chars) {
    const c = ch.codePointAt(0);
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127)) imprimibles++;
  }
  return imprimibles / chars.length >= 0.9;
}

/** Entropía de Shannon en bits por byte (0 = todo igual, 8 = parece cifrado o comprimido). Calculado aquí. */
export function entropia(b) {
  if (!b.length) return 0;
  const cuenta = new Uint32Array(256);
  for (const x of b) cuenta[x]++;
  let h = 0;
  for (const c of cuenta) {
    if (!c) continue;
    const p = c / b.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * Lista las entradas de un ZIP leyendo su directorio central.
 * Los desplazamientos son relativos al inicio del ZIP (= inicio del apéndice).
 */
export function listarZip(b) {
  const eocd = buscarEocd(b);
  if (eocd < 0) return [];
  const total = leer16le(b, eocd + 10);
  let p = leer32le(b, eocd + 16);
  const entradas = [];
  for (let n = 0; n < total; n++) {
    if (p + 46 > b.length || leer32le(b, p) !== 0x02014b50) break;
    const banderas = leer16le(b, p + 8);
    const metodo = leer16le(b, p + 10);
    const comprimido = leer32le(b, p + 20);
    const tamano = leer32le(b, p + 24);
    const largoNombre = leer16le(b, p + 28);
    const largoExtra = leer16le(b, p + 30);
    const largoComent = leer16le(b, p + 32);
    const local = leer32le(b, p + 42);
    const nombre = new TextDecoder().decode(b.subarray(p + 46, p + 46 + largoNombre));
    entradas.push({ nombre, metodo, comprimido, tamano, local, cifrado: (banderas & 1) === 1 });
    p += 46 + largoNombre + largoExtra + largoComent;
  }
  return entradas;
}

/** Bytes comprimidos de una entrada (a partir de su cabecera local). */
export function datosEntradaZip(b, entrada) {
  const p = entrada.local;
  if (p + 30 > b.length || leer32le(b, p) !== 0x04034b50) return null;
  const inicio = p + 30 + leer16le(b, p + 26) + leer16le(b, p + 28);
  return b.subarray(inicio, inicio + entrada.comprimido);
}

/** Descomprime una entrada (método 0 = guardado, 8 = deflate) con la API del navegador. */
export async function leerEntradaZip(b, entrada) {
  if (entrada.cifrado) throw new Error('La entrada está cifrada con contraseña: no se puede ver sin la clave.');
  const datos = datosEntradaZip(b, entrada);
  if (!datos) throw new Error('No se encontró la cabecera local de la entrada.');
  if (entrada.metodo === 0) return datos.slice();
  if (entrada.metodo !== 8) throw new Error(`Método de compresión ${entrada.metodo} no soportado aquí.`);
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no trae DecompressionStream.');
  const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/**
 * ¿Qué es el apéndice?
 * tipo: 'vacio' | 'relleno' | 'zip' | 'archivo' (otra firma conocida) | 'texto' | 'binario'
 */
export function clasificarApendice(b) {
  if (!b.length) return { tipo: 'vacio', descripcion: 'Nada después del fin.' };
  if (esRelleno(b)) return { tipo: 'relleno', descripcion: `${b.length} bytes de relleno (ceros o espacios). Habitual en algunas cámaras; no es sospechoso por sí solo.` };
  const firma = detectarTipo(b);
  if (firma && (firma.id === 'zip' || firma.id === 'zip-vacio')) {
    const entradas = listarZip(b);
    return { tipo: 'zip', firma, entradas, descripcion: `Un archivo ZIP pegado al final con ${entradas.length} ${entradas.length === 1 ? 'archivo' : 'archivos'} dentro.` };
  }
  if (firma) return { tipo: 'archivo', firma, descripcion: `Otro archivo pegado al final: ${firma.nombre}.` };
  if (esTexto(b)) return { tipo: 'texto', descripcion: `Texto legible pegado al final (${b.length} bytes).` };
  const h = entropia(b);
  return {
    tipo: 'binario',
    entropia: h,
    descripcion: `Datos binarios sin firma conocida (${b.length} bytes, entropía ${h.toFixed(2)} bits/byte${h > 7.5 ? ': parecen cifrados o comprimidos' : ''}).`,
  };
}
