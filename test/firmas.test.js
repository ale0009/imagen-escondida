import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectarTipo, compararExtension, extension, firmaHex } from '../js/firmas.js';

const b = (...x) => new Uint8Array(x);

test('detecta las firmas principales', () => {
  assert.equal(detectarTipo(b(0xff, 0xd8, 0xff, 0xe0, 0, 0x10)).id, 'jpg');
  assert.equal(detectarTipo(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)).id, 'png');
  assert.equal(detectarTipo(new TextEncoder().encode('GIF89a....')).id, 'gif');
  assert.equal(detectarTipo(new TextEncoder().encode('GIF87a....')).id, 'gif');
  assert.equal(detectarTipo(new TextEncoder().encode('%PDF-1.7\n')).id, 'pdf');
  assert.equal(detectarTipo(b(0x50, 0x4b, 0x03, 0x04, 0x14)).id, 'zip');
  assert.equal(detectarTipo(new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPVP8 ')).id, 'webp');
  assert.equal(detectarTipo(b(0x4d, 0x5a, 0x90, 0)).id, 'exe');
});

test('casos borde: vacío, demasiado corto y desconocido', () => {
  assert.equal(detectarTipo(b()), null);
  assert.equal(detectarTipo(b(0xff, 0xd8)), null, 'FFD8 sin el tercer FF no basta');
  assert.equal(detectarTipo(b(0x89, 0x50, 0x4e, 0x47)), null, 'PNG truncado en la firma');
  assert.equal(detectarTipo(new TextEncoder().encode('hola mundo')), null);
  assert.equal(detectarTipo(new TextEncoder().encode('RIFF\x10\x00\x00\x00WAVEfmt ')), null, 'RIFF que no es WebP');
});

test('extensión frente a firma', () => {
  const jpg = detectarTipo(b(0xff, 0xd8, 0xff, 0xe1));
  assert.equal(compararExtension('foto.JPG', jpg).estado, 'coincide');
  assert.equal(compararExtension('foto.jpeg', jpg).estado, 'coincide');
  assert.equal(compararExtension('foto.png', jpg).estado, 'no-coincide');
  assert.equal(compararExtension('sin_ext', jpg).estado, 'sin-extension');
  assert.equal(compararExtension('x.bin', null).estado, 'desconocida');
  const zip = detectarTipo(b(0x50, 0x4b, 0x03, 0x04));
  assert.equal(compararExtension('informe.docx', zip).estado, 'coincide');
  const tiffMM = detectarTipo(b(0x4d, 0x4d, 0x00, 0x2a));
  assert.equal(compararExtension('a.tif', tiffMM).estado, 'coincide');
});

test('utilidades', () => {
  assert.equal(extension('C:\\fotos\\a.b.PnG'), 'png');
  assert.equal(extension('.bashrc'), '');
  assert.equal(firmaHex(detectarTipo(new TextEncoder().encode('GIF89a'))), '47 49 46 38 ?? 61');
});
