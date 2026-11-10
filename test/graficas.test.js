import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, svgSegmentos } from '../js/graficas.js';
import { filasHex, zonasDe } from '../js/hex.js';

test('agrupar segmentos iguales consecutivos', () => {
  const g = agrupar([
    { marca: 0xd8, nombre: 'SOI · x', inicio: 0, largo: 2 },
    { marca: 0xc4, nombre: 'DHT · x', inicio: 2, largo: 10 },
    { marca: 0xc4, nombre: 'DHT · x', inicio: 12, largo: 20 },
  ]);
  assert.equal(g.length, 2);
  assert.equal(g[1].veces, 2);
  assert.equal(g[1].largo, 30);
});

test('svgSegmentos incluye el apéndice y escapa texto', () => {
  const svg = svgSegmentos([{ marca: 0xd8, nombre: 'SOI · <x>', inicio: 0, largo: 2 }], 10, 8);
  assert.match(svg, /APÉNDICE/);
  assert.ok(!svg.includes('<x>'));
});

test('filasHex marca zonas y alinea a 16', () => {
  const b = new Uint8Array(40).map((_, i) => i + 60);
  const f = filasHex(b, 20, 40, [{ desde: 16, hasta: 18, clase: 'z-firma' }]);
  assert.equal(f[0].offset, 16);
  assert.equal(f[0].celdas[0].clase, 'z-firma');
  assert.equal(f[0].celdas[2].clase, '');
  assert.equal(f[1].celdas.length, 8);
  assert.equal(zonasDe({ firma: null, fin: { fin: null }, apendice: new Uint8Array(0), tamano: 0 }).length, 0);
});
