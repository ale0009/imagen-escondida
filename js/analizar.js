// Junta todas las pruebas en un informe y un veredicto tipo videojuego.
// Función pura (salvo sha256, que usa WebCrypto y es asíncrona).

import { detectarTipo, compararExtension, firmaHex, aHex } from './firmas.js';
import { buscarFin } from './fin.js';
import { extraerApendice, clasificarApendice } from './apendice.js';
import { leerExif } from './exif.js';
import { md5 } from './md5.js';

/**
 * Puntos de sospecha (calculado aquí, criterio propio):
 *  extensión que no coincide con la firma … 40
 *  datos añadidos tras el fin (no relleno) … 60
 *  archivo truncado o estructura rota ……… 15
 * Avisos sin puntos: GPS, relleno, formato sin buscador de fin, comentarios.
 * Veredicto: 0 → LIMPIA · 1-39 → RARA · 40+ → ¡SOSPECHOSA!
 */
export function analizar(bytes, nombre) {
  const pruebas = [];
  let puntos = 0;

  const firma = detectarTipo(bytes);
  const ext = compararExtension(nombre, firma);
  if (!firma) {
    pruebas.push({ id: 'firma', estado: 'aviso', titulo: 'Firma desconocida', detalle: `Empieza con ${aHex(bytes, 0, 8) || '(vacío)'}: no es un formato que la herramienta conozca.` });
  } else if (ext.estado === 'no-coincide') {
    puntos += 40;
    pruebas.push({ id: 'firma', estado: 'mal', titulo: 'La extensión miente', detalle: `Se llama .${ext.ext}, pero sus primeros bytes (${firmaHex(firma)}) dicen: ${firma.nombre}.` });
  } else if (ext.estado === 'sin-extension') {
    pruebas.push({ id: 'firma', estado: 'aviso', titulo: 'Sin extensión', detalle: `Por la firma ${firmaHex(firma)} es: ${firma.nombre}.` });
  } else {
    pruebas.push({ id: 'firma', estado: 'bien', titulo: 'Firma y extensión coinciden', detalle: `${firmaHex(firma)} = ${firma.nombre}, como dice .${ext.ext}.` });
  }

  const fin = firma ? buscarFin(bytes, firma.id) : { fin: null, soportado: false, motivo: 'Sin firma conocida no se sabe dónde termina.' };
  let apendice = new Uint8Array(0);
  let clase = { tipo: 'vacio', descripcion: '' };
  if (fin.fin !== null) {
    apendice = extraerApendice(bytes, fin.fin);
    clase = clasificarApendice(apendice);
    if (clase.tipo === 'vacio') {
      pruebas.push({ id: 'fin', estado: 'bien', titulo: 'Termina donde debe', detalle: `${fin.nota} Fin en el byte ${fin.fin.toLocaleString('es-CO')} de ${bytes.length.toLocaleString('es-CO')}.` });
    } else if (clase.tipo === 'relleno') {
      pruebas.push({ id: 'fin', estado: 'aviso', titulo: 'Relleno tras el fin', detalle: clase.descripcion });
    } else {
      puntos += 60;
      pruebas.push({ id: 'fin', estado: 'mal', titulo: `${apendice.length.toLocaleString('es-CO')} bytes escondidos tras el fin`, detalle: `${fin.nota} ${clase.descripcion}` });
    }
  } else if (fin.soportado) {
    puntos += 15;
    pruebas.push({ id: 'fin', estado: 'aviso', titulo: 'Estructura incompleta', detalle: fin.motivo });
  } else {
    pruebas.push({ id: 'fin', estado: 'aviso', titulo: 'Fin no comprobado', detalle: fin.motivo });
  }

  let exif = null;
  if (firma && firma.id === 'jpg') {
    exif = leerExif(bytes);
    if (exif && exif.gps) {
      pruebas.push({ id: 'gps', estado: 'aviso', titulo: '¡Dice dónde se tomó!', detalle: `Trae coordenadas GPS: ${exif.gps.lat.toFixed(5)}, ${exif.gps.lon.toFixed(5)}. Quítalas antes de compartir la foto.` });
    } else if (exif && exif.campos.length) {
      pruebas.push({ id: 'gps', estado: 'bien', titulo: 'Metadatos sin GPS', detalle: `${exif.campos.length} campos EXIF, ninguno de ubicación.` });
    } else {
      pruebas.push({ id: 'gps', estado: 'bien', titulo: 'Sin metadatos EXIF', detalle: 'No trae marca, fechas ni ubicación.' });
    }
    if (exif && exif.comentarios.length) {
      pruebas.push({ id: 'comentario', estado: 'aviso', titulo: 'Comentario dentro del JPEG', detalle: `Segmento COM: «${exif.comentarios[0].slice(0, 120)}»` });
    }
  }

  const veredicto = puntos >= 40 ? 'sospechosa' : puntos > 0 ? 'rara' : 'limpia';
  return { nombre, tamano: bytes.length, firma, ext, fin, apendice, clase, exif, pruebas, puntos: Math.min(100, puntos), veredicto };
}

/** Texto grande del veredicto. */
export const TEXTO_VEREDICTO = { limpia: 'LIMPIA', rara: 'RARA', sospechosa: '¡SOSPECHOSA!' };

export function hashMd5(bytes) {
  return md5(bytes);
}

/** SHA-256 con WebCrypto (navegador y Node 20+). */
export async function sha256(bytes) {
  const h = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Compara un hash pegado por el usuario (ignora espacios y mayúsculas). */
export function compararHash(pegado, calculado) {
  const limpio = String(pegado || '').trim().toLowerCase().split(/\s+/)[0] || '';
  if (!limpio) return 'vacio';
  return limpio === calculado ? 'coincide' : 'distinto';
}
