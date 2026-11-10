import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { md5 } from '../js/md5.js';

// Vectores del apéndice A.5 de la RFC 1321.
const RFC1321 = [
  ['', 'd41d8cd98f00b204e9800998ecf8427e'],
  ['a', '0cc175b9c0f1b6a831c399e269772661'],
  ['abc', '900150983cd24fb0d6963f7d28e17f72'],
  ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
  ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
  ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
  ['12345678901234567890123456789012345678901234567890123456789012345678901234567890', '57edf4a22be3c955ac49da2e2107b67a'],
];

test('MD5 cumple los 7 vectores de la RFC 1321', () => {
  for (const [entrada, esperado] of RFC1321) assert.equal(md5(entrada), esperado, JSON.stringify(entrada));
});

test('MD5: bordes del relleno (55, 56, 63, 64, 65 bytes) contra node:crypto', () => {
  for (const n of [55, 56, 57, 63, 64, 65, 119, 120, 128]) {
    const b = new Uint8Array(n).fill(0x61);
    assert.equal(md5(b), createHash('md5').update(b).digest('hex'), `n=${n}`);
  }
});

test('MD5: datos aleatorios y una subvista (byteOffset ≠ 0)', () => {
  for (let i = 0; i < 50; i++) {
    const b = new Uint8Array(randomBytes(1 + i * 37));
    assert.equal(md5(b), createHash('md5').update(b).digest('hex'));
  }
  const grande = new Uint8Array(randomBytes(300));
  const vista = grande.subarray(7, 207);
  assert.equal(md5(vista), createHash('md5').update(vista).digest('hex'));
});
