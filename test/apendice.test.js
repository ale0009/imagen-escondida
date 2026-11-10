import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extraerApendice, clasificarApendice, esRelleno, esTexto, entropia, listarZip, leerEntradaZip } from '../js/apendice.js';
import { analizar, sha256, compararHash } from '../js/analizar.js';
import { leerExif } from '../js/exif.js';

const leer = (n) => new Uint8Array(readFileSync(new URL(`../ejemplos/${n}`, import.meta.url)));
const t = (s) => new TextEncoder().encode(s);

test('extraerApendice: bordes', () => {
  const b = t('abcdef');
  assert.deepEqual([...extraerApendice(b, 4)], [...t('ef')]);
  assert.equal(extraerApendice(b, 6).length, 0);
  assert.equal(extraerApendice(b, null).length, 0);
});

test('clasificación: texto, relleno, binario, otro archivo', () => {
  assert.equal(clasificarApendice(t('Mensaje secreto: ñandú')).tipo, 'texto');
  assert.equal(clasificarApendice(new Uint8Array(64)).tipo, 'relleno');
  assert.equal(clasificarApendice(new Uint8Array(0)).tipo, 'vacio');
  assert.equal(clasificarApendice(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])).tipo, 'archivo');
  const ruido = new Uint8Array(4096).map((_, i) => (i * 2654435761) >>> 24);
  const c = clasificarApendice(ruido);
  assert.equal(c.tipo, 'binario');
  assert.ok(c.entropia > 7);
  assert.ok(esRelleno(t('   \n')) && !esRelleno(t('a')));
  assert.ok(!esTexto(new Uint8Array([0xc3, 0x28])), 'UTF-8 inválido no es texto');
  assert.equal(entropia(new Uint8Array(10)), 0);
});

test('ejemplo limpia.png: LIMPIA, sin apéndice', () => {
  const inf = analizar(leer('limpia.png'), 'limpia.png');
  assert.equal(inf.veredicto, 'limpia');
  assert.equal(inf.fin.fin, inf.tamano);
  assert.equal(inf.apendice.length, 0);
});

test('ejemplo sospechosa.jpg: ZIP tras FFD9, extraíble, con GPS', async () => {
  const b = leer('sospechosa.jpg');
  const inf = analizar(b, 'sospechosa.jpg');
  assert.equal(inf.veredicto, 'sospechosa');
  assert.equal(b[inf.fin.fin - 2], 0xff);
  assert.equal(b[inf.fin.fin - 1], 0xd9);
  assert.equal(inf.clase.tipo, 'zip');
  const entradas = listarZip(inf.apendice);
  assert.deepEqual(entradas.map((e) => e.nombre), ['mensaje.txt']);
  const texto = new TextDecoder().decode(await leerEntradaZip(inf.apendice, entradas[0]));
  assert.match(texto, /MENSAJE DE EJEMPLO/);
  assert.equal(texto.length, entradas[0].tamano);
  const exif = leerExif(b);
  assert.ok(Math.abs(exif.gps.lat - 4.5981) < 1e-4 && Math.abs(exif.gps.lon + 74.076) < 1e-4);
  assert.ok(inf.pruebas.some((p) => p.id === 'gps' && p.estado === 'aviso'));
});

test('la extensión que miente suma sospecha', () => {
  const inf = analizar(leer('limpia.png'), 'vacaciones.jpg');
  assert.equal(inf.veredicto, 'sospechosa');
  assert.ok(inf.pruebas.some((p) => p.id === 'firma' && p.estado === 'mal'));
});

test('SHA-256 (WebCrypto) coincide con node:crypto y compararHash tolera formato md5sum', async () => {
  const b = leer('limpia.png');
  const h = await sha256(b);
  assert.equal(h, createHash('sha256').update(b).digest('hex'));
  assert.equal(compararHash(`  ${h.toUpperCase()}  limpia.png`, h), 'coincide');
  assert.equal(compararHash('abc', h), 'distinto');
  assert.equal(compararHash('', h), 'vacio');
});
