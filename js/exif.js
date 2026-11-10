// EXIF básico de un JPEG, sin librerías: marca, modelo, software, fechas y, sobre todo, GPS.
// Estructura: segmento APP1 "Exif\0\0" → cabecera TIFF (II = little-endian, MM = big-endian)
// → IFD0 → (puntero 8769) IFD EXIF y (puntero 8825) IFD GPS.

import { segmentosJpeg } from './fin.js';

const TAGS_0 = { 0x010f: 'Marca', 0x0110: 'Modelo', 0x0131: 'Software', 0x0132: 'Fecha de modificación', 0x013b: 'Autor', 0x8298: 'Copyright', 0x010e: 'Descripción' };
const TAGS_EXIF = { 0x9003: 'Fecha original', 0x9004: 'Fecha de digitalización', 0xa430: 'Dueño de la cámara', 0xa431: 'N.º de serie del cuerpo', 0xa434: 'Lente' };
const TAMANO = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function lector(b, base, le) {
  const u16 = (o) => (le ? b[base + o] | (b[base + o + 1] << 8) : (b[base + o] << 8) | b[base + o + 1]);
  const u32 = (o) => (le
    ? (b[base + o] | (b[base + o + 1] << 8) | (b[base + o + 2] << 16) | (b[base + o + 3] << 24)) >>> 0
    : ((b[base + o] << 24) | (b[base + o + 1] << 16) | (b[base + o + 2] << 8) | b[base + o + 3]) >>> 0);
  return { u16, u32 };
}

/** Lee una IFD → Map(tag → valor). Ignora lo que se salga de los límites. */
function leerIfd(b, base, limite, le, off) {
  const { u16, u32 } = lector(b, base, le);
  const out = new Map();
  if (typeof off !== 'number' || off + 2 > limite) return out;
  const n = u16(off);
  for (let k = 0; k < n && k < 512; k++) {
    const e = off + 2 + k * 12;
    if (e + 12 > limite) break;
    const tag = u16(e);
    const tipo = u16(e + 2);
    const cuenta = u32(e + 4);
    const tam = (TAMANO[tipo] || 1) * cuenta;
    const pos = tam <= 4 ? e + 8 : u32(e + 8);
    if (pos + tam > limite) continue;
    let valor;
    if (tipo === 2) {
      valor = '';
      for (let i = 0; i < cuenta; i++) { const c = b[base + pos + i]; if (!c) break; valor += String.fromCharCode(c); }
      valor = valor.trim();
    } else if (tipo === 3) valor = cuenta === 1 ? u16(pos) : Array.from({ length: cuenta }, (_, i) => u16(pos + 2 * i));
    else if (tipo === 4) valor = cuenta === 1 ? u32(pos) : Array.from({ length: cuenta }, (_, i) => u32(pos + 4 * i));
    else if (tipo === 5) valor = Array.from({ length: cuenta }, (_, i) => { const d = u32(pos + 8 * i + 4); return d ? u32(pos + 8 * i) / d : 0; });
    else if (tipo === 1 || tipo === 7) valor = Array.from({ length: cuenta }, (_, i) => b[base + pos + i]);
    else continue;
    out.set(tag, valor);
  }
  return out;
}

const aDecimal = (dms, ref) => {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const v = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return ref === 'S' || ref === 'W' ? -v : v;
};

/** Devuelve { campos: [{nombre, valor}], gps: {lat, lon} | null, comentarios: [texto] } o null si no hay nada. */
export function leerExif(b) {
  const { segmentos } = segmentosJpeg(b);
  const comentarios = segmentos
    .filter((s) => s.marca === 0xfe)
    .map((s) => new TextDecoder('utf-8').decode(b.subarray(s.inicio + 4, s.inicio + s.largo)).replace(/\0+$/, ''));
  const esExif = (s) => s.marca === 0xe1 && b[s.inicio + 4] === 0x45 && b[s.inicio + 5] === 0x78 && b[s.inicio + 6] === 0x69 && b[s.inicio + 7] === 0x66 && b[s.inicio + 8] === 0 && b[s.inicio + 9] === 0;
  const app1 = segmentos.find(esExif);
  if (!app1) return comentarios.length ? { campos: [], gps: null, comentarios } : null;
  const base = app1.inicio + 10;
  const limite = app1.inicio + app1.largo - base;
  const le = b[base] === 0x49 && b[base + 1] === 0x49;
  const { u16, u32 } = lector(b, base, le);
  if (u16(2) !== 42) return { campos: [], gps: null, comentarios };
  const ifd0 = leerIfd(b, base, limite, le, u32(4));
  const campos = [];
  for (const [tag, nombre] of Object.entries(TAGS_0)) if (ifd0.has(+tag)) campos.push({ nombre, valor: String(ifd0.get(+tag)) });
  if (ifd0.has(0x8769)) {
    const ex = leerIfd(b, base, limite, le, ifd0.get(0x8769));
    for (const [tag, nombre] of Object.entries(TAGS_EXIF)) if (ex.has(+tag)) campos.push({ nombre, valor: String(ex.get(+tag)) });
  }
  let gps = null;
  if (ifd0.has(0x8825)) {
    const g = leerIfd(b, base, limite, le, ifd0.get(0x8825));
    const lat = aDecimal(g.get(2), g.get(1));
    const lon = aDecimal(g.get(4), g.get(3));
    if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) gps = { lat, lon };
  }
  return { campos, gps, comentarios };
}
