// Interfaz de la herramienta. Toda la lógica está en módulos puros; aquí solo se pinta.

import { analizar, TEXTO_VEREDICTO, hashMd5, sha256, compararHash } from './analizar.js';
import { filasHex, ventanas, zonasDe } from './hex.js';
import { leerEntradaZip } from './apendice.js';
import { iniciarTema } from './tema.js';

const $ = (id) => document.getElementById(id);
const MAX = 200 * 1024 * 1024; // 200 MB: más allá el navegador sufre.
let urlMiniatura = null;
let urlDescarga = null;
let hashes = { md5: '', sha: '' };

const el = (tag, props = {}, ...hijos) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const h of hijos) n.append(h);
  return n;
};

const bytesTexto = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
const ETIQUETA = { bien: 'OK', aviso: 'OJO', mal: 'ALERTA' };

function pintarPruebas(inf) {
  const lista = $('pruebas');
  lista.replaceChildren(...inf.pruebas.map((p) => el('li', { class: `prueba prueba-${p.estado}` },
    el('span', { class: 'sello', text: ETIQUETA[p.estado] }),
    el('span', { class: 'prueba-txt' }, el('strong', { text: p.titulo }), el('span', { text: p.detalle })))));
  const v = $('veredicto');
  v.textContent = TEXTO_VEREDICTO[inf.veredicto];
  v.className = `v-${inf.veredicto}`;
  $('puntos').textContent = String(inf.puntos);
  $('medidor').setAttribute('aria-valuenow', String(inf.puntos));
  $('barra-relleno').style.width = `${inf.puntos}%`;
  $('barra-relleno').className = inf.puntos >= 40 ? 'alto' : inf.puntos > 0 ? 'medio' : '';
}

function pintarHex(bytes, inf) {
  const zonas = zonasDe(inf);
  const cont = $('hex');
  cont.replaceChildren();
  for (const w of ventanas(inf)) {
    const filas = filasHex(bytes, w.desde, w.hasta, zonas);
    const tabla = el('div', { class: 'hex-tabla', role: 'table', 'aria-label': w.titulo });
    for (const f of filas) {
      const fila = el('div', { class: 'hex-fila', role: 'row' });
      fila.append(el('span', { class: 'hex-off', role: 'rowheader', text: f.offset.toString(16).toUpperCase().padStart(8, '0') }));
      const hx = el('span', { class: 'hex-bytes', role: 'cell' });
      const as = el('span', { class: 'hex-ascii', role: 'cell' });
      for (const c of f.celdas) {
        hx.append(el('span', { class: c.clase, text: c.hex }), ' ');
        as.append(el('span', { class: c.clase, text: c.ascii }));
      }
      fila.append(hx, as);
      tabla.append(fila);
    }
    cont.append(el('h3', { class: 'hex-t', text: w.titulo }), tabla);
  }
}

function pintarApendice(inf) {
  const panel = $('panel-apendice');
  const hay = inf.apendice.length && inf.clase.tipo !== 'relleno';
  panel.hidden = !hay;
  if (urlDescarga) URL.revokeObjectURL(urlDescarga);
  urlDescarga = null;
  if (!hay) return;
  $('ap-desc').textContent = `${inf.clase.descripcion} Empieza en el byte ${inf.fin.fin.toLocaleString('es-CO')}.`;
  const vista = $('ap-vista');
  vista.hidden = true;
  const lista = $('ap-entradas');
  lista.replaceChildren();
  if (inf.clase.tipo === 'zip') {
    for (const e of inf.clase.entradas) {
      const b = el('button', { class: 'mini', type: 'button', text: 'Ver' });
      b.addEventListener('click', async () => {
        try {
          const datos = await leerEntradaZip(inf.apendice, e);
          vista.textContent = new TextDecoder().decode(datos.subarray(0, 20000));
        } catch (err) {
          vista.textContent = `No se pudo abrir: ${err.message}`;
        }
        vista.hidden = false;
        vista.focus();
      });
      lista.append(el('li', {}, el('code', { text: e.nombre }), ` · ${bytesTexto(e.tamano)}${e.cifrado ? ' · cifrado' : ''} `, b));
    }
  } else if (inf.clase.tipo === 'texto') {
    vista.textContent = new TextDecoder().decode(inf.apendice.subarray(0, 20000));
    vista.hidden = false;
  }
  const ext = inf.clase.tipo === 'zip' ? 'zip' : inf.clase.tipo === 'texto' ? 'txt' : inf.clase.firma ? inf.clase.firma.ext[0] || 'bin' : 'bin';
  urlDescarga = URL.createObjectURL(new Blob([inf.apendice], { type: 'application/octet-stream' }));
  $('ap-descargar').onclick = () => {
    const a = el('a', { href: urlDescarga, download: `apendice-${inf.nombre}.${ext}` });
    document.body.append(a);
    a.click();
    a.remove();
  };
}

function pintarExif(inf) {
  const cont = $('exif');
  if (!inf.firma || inf.firma.id !== 'jpg') { cont.replaceChildren(el('p', { class: 'tenue', text: 'Los metadatos EXIF se leen solo en JPG.' })); return; }
  const x = inf.exif;
  if (!x || (!x.campos.length && !x.gps)) { cont.replaceChildren(el('p', { class: 'tenue', text: 'Sin EXIF: no hay marca, fechas ni ubicación.' })); return; }
  const dl = el('dl', { class: 'tabla-exif' });
  for (const c of x.campos) dl.append(el('dt', { text: c.nombre }), el('dd', { text: c.valor }));
  if (x.gps) dl.append(el('dt', { class: 'gps', text: 'GPS' }), el('dd', { class: 'gps', text: `${x.gps.lat.toFixed(5)}, ${x.gps.lon.toFixed(5)}` }));
  cont.replaceChildren(dl);
}

async function procesar(bytes, nombre, esEjemplo) {
  const inf = analizar(bytes, nombre);
  $('nombre').textContent = nombre;
  $('tamano').textContent = bytesTexto(bytes.length);
  $('chip-ejemplo').hidden = !esEjemplo;
  if (urlMiniatura) URL.revokeObjectURL(urlMiniatura);
  urlMiniatura = null;
  const img = $('miniatura');
  if (inf.firma && ['jpg', 'png', 'gif', 'webp', 'bmp'].includes(inf.firma.id)) {
    urlMiniatura = URL.createObjectURL(new Blob([bytes], { type: `image/${inf.firma.id === 'jpg' ? 'jpeg' : inf.firma.id}` }));
    img.src = urlMiniatura;
    img.alt = `Vista previa de ${nombre}`;
    img.hidden = false;
  } else img.hidden = true;
  pintarPruebas(inf);
  pintarApendice(inf);
  pintarHex(bytes, inf);
  pintarExif(inf);
  $('h-md5').textContent = 'calculando…';
  $('h-sha').textContent = 'calculando…';
  hashes = { md5: hashMd5(bytes), sha: await sha256(bytes) };
  $('h-md5').textContent = hashes.md5;
  $('h-sha').textContent = hashes.sha;
  comparar();
}

function comparar() {
  const v = $('esperado').value;
  const out = $('comparacion');
  if (!hashes.md5) return;
  const limpio = v.trim().toLowerCase().split(/\s+/)[0] || '';
  const r = compararHash(v, limpio.length === 64 ? hashes.sha : hashes.md5);
  out.className = `comparacion c-${r}`;
  out.textContent = r === 'vacio' ? '' : r === 'coincide' ? 'COINCIDE: es exactamente el mismo archivo.' : 'NO COINCIDE: el archivo cambió o es otro.';
}

function error(msg) {
  const v = $('veredicto');
  v.textContent = 'ERROR';
  v.className = 'v-rara';
  $('pruebas').replaceChildren(el('li', { class: 'prueba prueba-aviso' }, el('span', { class: 'sello', text: 'OJO' }), el('span', { class: 'prueba-txt', text: msg })));
}

async function cargarArchivo(f) {
  if (!f) return;
  if (f.size > MAX) { error(`El archivo pesa ${bytesTexto(f.size)}; el límite es ${bytesTexto(MAX)} para no colgar el navegador.`); return; }
  try {
    await procesar(new Uint8Array(await f.arrayBuffer()), f.name, false);
  } catch (e) {
    error(`No se pudo leer el archivo: ${e.message}`);
  }
}

async function cargarEjemplo(nombre) {
  try {
    const r = await fetch(`ejemplos/${nombre}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await procesar(new Uint8Array(await r.arrayBuffer()), nombre, true);
  } catch (e) {
    error(`No se pudo cargar el ejemplo (${e.message}). Abre la página desde un servidor, no como archivo suelto.`);
  }
}

iniciarTema($('tema'));
$('archivo').addEventListener('change', (e) => cargarArchivo(e.target.files[0]));
const zona = $('zona');
zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('archivo').click(); } });
zona.tabIndex = 0;
for (const t of ['dragenter', 'dragover']) zona.addEventListener(t, (e) => { e.preventDefault(); zona.classList.add('encima'); });
for (const t of ['dragleave', 'drop']) zona.addEventListener(t, () => zona.classList.remove('encima'));
zona.addEventListener('drop', (e) => { e.preventDefault(); cargarArchivo(e.dataTransfer.files[0]); });
// Soltar fuera de la zona no debe abrir el archivo en la pestaña.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => { e.preventDefault(); if (e.target !== zona && !zona.contains(e.target)) cargarArchivo(e.dataTransfer.files[0]); });
document.querySelectorAll('[data-ejemplo]').forEach((b) => b.addEventListener('click', () => cargarEjemplo(b.dataset.ejemplo)));
document.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($(b.dataset.copiar).textContent); b.textContent = 'Copiado'; } catch { b.textContent = 'Selecciónalo'; }
  setTimeout(() => { b.textContent = 'Copiar'; }, 1500);
}));
$('esperado').addEventListener('input', comparar);
cargarEjemplo('sospechosa.jpg');
