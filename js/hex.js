// Visor hexadecimal: filas de 16 bytes con cada byte marcado por zona.

/**
 * zonas: [{ desde, hasta, clase }] (hasta exclusivo). Gana la última que aplique.
 * Devuelve [{ offset, celdas: [{ hex, ascii, clase }] }].
 */
export function filasHex(bytes, desde, hasta, zonas = []) {
  const ini = Math.max(0, Math.floor(desde / 16) * 16);
  const fin = Math.min(bytes.length, hasta);
  const filas = [];
  for (let o = ini; o < fin; o += 16) {
    const celdas = [];
    for (let i = o; i < Math.min(o + 16, fin); i++) {
      const b = bytes[i];
      let clase = '';
      for (const z of zonas) if (i >= z.desde && i < z.hasta) clase = z.clase;
      celdas.push({ hex: b.toString(16).toUpperCase().padStart(2, '0'), ascii: b >= 32 && b < 127 ? String.fromCharCode(b) : '·', clase });
    }
    filas.push({ offset: o, celdas });
  }
  return filas;
}

/** Ventanas a mostrar: el inicio y, si hay fin, la frontera fin/apéndice. */
export function ventanas(informe) {
  const v = [{ titulo: 'Inicio del archivo · la firma', desde: 0, hasta: 64 }];
  const f = informe.fin;
  if (f && f.fin !== null) {
    const desde = Math.max(64, (f.marcador ? f.marcador.inicio : f.fin) - 32);
    const extra = informe.apendice.length ? 96 : 0;
    v.push({ titulo: informe.apendice.length ? 'Frontera · fin del archivo y lo que viene después' : 'Final del archivo · el marcador de fin', desde, hasta: Math.min(informe.tamano, f.fin + extra) });
  }
  return v;
}

export function zonasDe(informe) {
  const z = [];
  if (informe.firma) z.push({ desde: 0, hasta: informe.firma.bytes.length, clase: 'z-firma' });
  const f = informe.fin;
  if (f && f.fin !== null) {
    if (f.marcador) z.push({ desde: f.marcador.inicio, hasta: f.marcador.inicio + f.marcador.largo, clase: 'z-fin' });
    if (informe.apendice.length) z.push({ desde: f.fin, hasta: informe.tamano, clase: 'z-apendice' });
  }
  return z;
}
