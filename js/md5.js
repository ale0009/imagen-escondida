// MD5 (RFC 1321) escrito aquí, porque WebCrypto no lo trae (lo considera roto para firmas).
// Sigue siendo útil en forense: es el hash que aparece en las actas y en md5sum.
// No sirve para seguridad (hay colisiones conocidas); para eso está el SHA-256.

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

// K[i] = floor(|sin(i + 1)| · 2^32), como manda la RFC.
const K = new Uint32Array(64);
for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;

const rotl = (x, c) => (x << c) | (x >>> (32 - c));

/** Procesa un bloque de 64 bytes (16 palabras little-endian) sobre el estado h. */
function bloque(h, M) {
  let a = h[0], b = h[1], c = h[2], d = h[3];
  for (let i = 0; i < 64; i++) {
    let f, g;
    if (i < 16) { f = (b & c) | (~b & d); g = i; }
    else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
    else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
    else { f = c ^ (b | ~d); g = (7 * i) & 15; }
    const t = d;
    d = c;
    c = b;
    b = (b + rotl((a + f + K[i] + M[g]) | 0, S[i])) | 0;
    a = t;
  }
  h[0] = (h[0] + a) | 0;
  h[1] = (h[1] + b) | 0;
  h[2] = (h[2] + c) | 0;
  h[3] = (h[3] + d) | 0;
}

/** MD5 de un Uint8Array (o texto) → hexadecimal en minúsculas, como md5sum. */
export function md5(entrada) {
  const datos = typeof entrada === 'string' ? new TextEncoder().encode(entrada) : entrada;
  const h = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476]);
  const M = new Int32Array(16);
  const n = datos.length;
  const completos = Math.floor(n / 64);
  const vista = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  for (let k = 0; k < completos; k++) {
    for (let j = 0; j < 16; j++) M[j] = vista.getInt32(k * 64 + j * 4, true);
    bloque(h, M);
  }
  // Relleno: 0x80, ceros y la longitud en bits (64 bits, little-endian).
  const resto = n - completos * 64;
  const cola = new Uint8Array(resto < 56 ? 64 : 128);
  cola.set(datos.subarray(completos * 64));
  cola[resto] = 0x80;
  const bits = n * 8;
  const vc = new DataView(cola.buffer);
  vc.setUint32(cola.length - 8, bits >>> 0, true);
  vc.setUint32(cola.length - 4, Math.floor(bits / 2 ** 32), true);
  for (let k = 0; k < cola.length; k += 64) {
    for (let j = 0; j < 16; j++) M[j] = vc.getInt32(k + j * 4, true);
    bloque(h, M);
  }
  const out = new Uint8Array(h.buffer);
  return Array.from(out, (x) => x.toString(16).padStart(2, '0')).join('');
}
