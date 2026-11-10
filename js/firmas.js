// Firmas mágicas: los primeros bytes que delatan qué es un archivo, diga lo que diga su extensión.
// Valores de las especificaciones públicas de cada formato (ver /proceso/ → Fuentes).

/** @typedef {{ id: string, nombre: string, bytes: (number|null)[], desplazamiento?: number, ext: string[] }} Firma */

/** Orden: de la más larga a la más corta, para que gane la más específica. */
export const FIRMAS = /** @type {Firma[]} */ ([
  { id: 'png', nombre: 'Imagen PNG', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ext: ['png'] },
  { id: 'ole', nombre: 'Documento OLE (Office 97-2003)', bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], ext: ['doc', 'xls', 'ppt', 'msg'] },
  { id: 'webp', nombre: 'Imagen WebP', bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], ext: ['webp'] },
  { id: 'rar', nombre: 'Archivo RAR', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], ext: ['rar'] },
  { id: '7z', nombre: 'Archivo 7-Zip', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], ext: ['7z'] },
  { id: 'gif', nombre: 'Imagen GIF', bytes: [0x47, 0x49, 0x46, 0x38, null, 0x61], ext: ['gif'] },
  { id: 'pdf', nombre: 'Documento PDF', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], ext: ['pdf'] },
  { id: 'zip', nombre: 'Archivo ZIP (o DOCX, XLSX, JAR, APK…)', bytes: [0x50, 0x4b, 0x03, 0x04], ext: ['zip', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'jar', 'apk', 'epub'] },
  { id: 'zip-vacio', nombre: 'Archivo ZIP vacío', bytes: [0x50, 0x4b, 0x05, 0x06], ext: ['zip'] },
  { id: 'elf', nombre: 'Ejecutable ELF (Linux)', bytes: [0x7f, 0x45, 0x4c, 0x46], ext: ['', 'so', 'bin', 'elf'] },
  { id: 'tiff', nombre: 'Imagen TIFF', bytes: [0x49, 0x49, 0x2a, 0x00], ext: ['tif', 'tiff', 'dng'] },
  { id: 'tiff', nombre: 'Imagen TIFF', bytes: [0x4d, 0x4d, 0x00, 0x2a], ext: ['tif', 'tiff', 'dng'] },
  { id: 'ico', nombre: 'Icono ICO', bytes: [0x00, 0x00, 0x01, 0x00], ext: ['ico'] },
  { id: 'jpg', nombre: 'Imagen JPEG', bytes: [0xff, 0xd8, 0xff], ext: ['jpg', 'jpeg', 'jpe', 'jfif'] },
  { id: 'mp3', nombre: 'Audio MP3 (ID3)', bytes: [0x49, 0x44, 0x33], ext: ['mp3'] },
  { id: 'gzip', nombre: 'Comprimido GZIP', bytes: [0x1f, 0x8b], ext: ['gz', 'tgz'] },
  { id: 'exe', nombre: 'Ejecutable de Windows (MZ)', bytes: [0x4d, 0x5a], ext: ['exe', 'dll', 'sys', 'scr'] },
  { id: 'bmp', nombre: 'Imagen BMP', bytes: [0x42, 0x4d], ext: ['bmp', 'dib'] },
]);

/** ¿Coinciden los bytes en la posición `pos` con la firma? (null = comodín) */
export function coincide(bytes, firma, pos = 0) {
  const patron = firma.bytes;
  if (pos + patron.length > bytes.length) return false;
  for (let i = 0; i < patron.length; i++) {
    if (patron[i] !== null && bytes[pos + i] !== patron[i]) return false;
  }
  return true;
}

/** Detecta el tipo real por la firma. Devuelve la firma o null. */
export function detectarTipo(bytes, pos = 0) {
  for (const f of FIRMAS) if (coincide(bytes, f, pos)) return f;
  return null;
}

/** Extensión en minúsculas, sin punto ('' si no hay). */
export function extension(nombre) {
  const base = String(nombre || '').split(/[\\/]/).pop() || '';
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}

/**
 * Compara la extensión con la firma.
 * estado: 'coincide' | 'no-coincide' | 'desconocida' (firma que no conocemos) | 'sin-extension'
 */
export function compararExtension(nombre, firma) {
  const ext = extension(nombre);
  if (!firma) return { estado: 'desconocida', ext, esperado: [] };
  if (!ext) return { estado: 'sin-extension', ext, esperado: firma.ext };
  // Varias firmas comparten id (TIFF II/MM): se aceptan las extensiones de todas.
  const esperado = [...new Set(FIRMAS.filter((f) => f.id === firma.id).flatMap((f) => f.ext))];
  return { estado: esperado.includes(ext) ? 'coincide' : 'no-coincide', ext, esperado };
}

/** Bytes en hexadecimal separados por espacios: [255,216] → "FF D8". */
export function aHex(bytes, desde = 0, cuantos = bytes.length) {
  const out = [];
  for (let i = desde; i < Math.min(bytes.length, desde + cuantos); i++) out.push(bytes[i].toString(16).toUpperCase().padStart(2, '0'));
  return out.join(' ');
}

/** Firma como texto, con ?? en los comodines. */
export function firmaHex(firma) {
  return firma.bytes.map((b) => (b === null ? '??' : b.toString(16).toUpperCase().padStart(2, '0'))).join(' ');
}
