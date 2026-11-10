import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finJpeg, finPng, finGif, finPdf, finZip, finBmp, buscarFin, segmentosJpeg } from '../js/fin.js';

const cat = (...partes) => {
  const arr = partes.flatMap((p) => (typeof p === 'string' ? [...new TextEncoder().encode(p)] : p));
  return new Uint8Array(arr);
};
const seg = (m, datos) => [0xff, m, (datos.length + 2) >> 8, (datos.length + 2) & 0xff, ...datos];

// JPEG mínimo sintético: SOI, APP0, SOS, datos, EOI.
const jpegBase = (datos) => [0xff, 0xd8, ...seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]), ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]), ...datos, 0xff, 0xd9];

test('JPEG: fin tras FFD9 y apéndice', () => {
  const j = jpegBase([1, 2, 3]);
  assert.equal(finJpeg(cat(j)).fin, j.length);
  assert.equal(finJpeg(cat(j, 'secreto')).fin, j.length);
});

test('JPEG: un FFD9 dentro de la miniatura EXIF (APP1) NO es el fin', () => {
  const miniatura = [0xff, 0xd8, 0xff, 0xd9];
  const j = [0xff, 0xd8, ...seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, ...miniatura]), ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]), 7, 7, 0xff, 0xd9];
  const r = finJpeg(cat(j, 'X'));
  assert.equal(r.fin, j.length);
  assert.notEqual(r.fin, 2 + 4 + 6 + 4, 'no debe cortar en el FFD9 de la miniatura');
});

test('JPEG: FF00 (relleno de bytes) y RST en los datos no cortan', () => {
  const j = jpegBase([0xff, 0x00, 5, 0xff, 0xd0, 6, 0xff, 0xd7, 0xff, 0x00]);
  assert.equal(finJpeg(cat(j, [0xde, 0xad])).fin, j.length);
});

test('JPEG: FF de relleno antes de un marcador y JPEG progresivo con dos SOS', () => {
  const j = [0xff, 0xd8, 0xff, 0xff, ...seg(0xdb, [0, 1]), ...seg(0xda, [1]), 9, 9, ...seg(0xc4, [0]), ...seg(0xda, [1]), 8, 0xff, 0xff, 0xd9];
  const r = segmentosJpeg(cat(j, 'z'));
  assert.equal(r.fin, j.length);
  assert.equal(r.segmentos.filter((s) => s.marca === 0xda).length, 2);
});

test('JPEG: truncado (sin EOI) y longitud inválida', () => {
  const j = jpegBase([1, 2, 3]).slice(0, -2);
  assert.equal(finJpeg(cat(j)).fin, null);
  assert.match(finJpeg(cat(j)).motivo, /truncado/);
  assert.equal(finJpeg(cat([0xff, 0xd8, 0xff, 0xe0, 0, 1])).fin, null);
  assert.equal(finJpeg(cat('no soy jpeg')).fin, null);
});

// PNG sintético (los CRC no se validan: la herramienta busca estructura, no integridad).
const chunk = (tipo, datos) => [0, 0, datos.length >> 8, datos.length & 0xff, ...new TextEncoder().encode(tipo), ...datos, 1, 2, 3, 4];
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

test('PNG: fin tras IEND+CRC, con apéndice', () => {
  const p = [...FIRMA_PNG, ...chunk('IHDR', new Array(13).fill(0)), ...chunk('IDAT', [1, 2, 3]), ...chunk('IEND', [])];
  assert.equal(finPng(cat(p)).fin, p.length);
  const r = finPng(cat(p, 'PK hola'));
  assert.equal(r.fin, p.length);
  assert.equal(r.marcador.inicio, p.length - 8);
});

test('PNG: la palabra IEND dentro de los datos de otro bloque no engaña', () => {
  const p = [...FIRMA_PNG, ...chunk('tEXt', [...new TextEncoder().encode('IEND falso')]), ...chunk('IEND', [])];
  assert.equal(finPng(cat(p)).fin, p.length);
});

test('PNG: truncado, sin IEND y bloque con longitud imposible', () => {
  const p = [...FIRMA_PNG, ...chunk('IHDR', new Array(13).fill(0))];
  assert.equal(finPng(cat(p)).fin, null);
  const roto = [...FIRMA_PNG, 0x7f, 0, 0, 0, ...new TextEncoder().encode('IDAT'), 1];
  assert.match(finPng(cat(roto)).motivo, /truncado/);
});

test('GIF, PDF, ZIP y BMP', () => {
  const gif = [...new TextEncoder().encode('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255,
    0x21, 0xf9, 4, 0, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 0x01, 0, 0x3b];
  assert.equal(finGif(cat(gif, 'extra')).fin, gif.length);
  const pdf = '%PDF-1.4\n...%%EOF\nedición\n%%EOF\n';
  assert.equal(finPdf(cat(pdf, 'pegado')).fin, new TextEncoder().encode(pdf).length, 'usa el ÚLTIMO %%EOF');
  const eocd = [0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.equal(finZip(cat(eocd, 'mas')).fin, 22);
  const bmp = [0x42, 0x4d, 20, 0, 0, 0, ...new Array(14).fill(0)];
  assert.equal(finBmp(cat(bmp, 'zz')).fin, 20);
  assert.equal(buscarFin(cat('ID3'), 'mp3').soportado, false);
});
