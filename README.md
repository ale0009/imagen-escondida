# ¿Hay algo escondido en esta imagen?

Suelta una foto (o cualquier archivo) y la herramienta revisa, **sin subirla a ningún lado**:

- **Firma mágica frente a extensión**: ¿el `.jpg` empieza de verdad con `FF D8 FF`? Reconoce JPG, PNG, GIF, PDF, ZIP/DOCX, WebP, BMP, RAR, 7-Zip, GZIP, TIFF, ICO, MP3, OLE, EXE y ELF.
- **Bytes después del fin**: recorre la estructura (segmentos JPEG hasta `FF D9`, bloques PNG hasta `IEND`, GIF hasta `3B`, último `%%EOF` de un PDF, fin de directorio ZIP). Si sobra algo, dice qué es (ZIP, texto, otro archivo, binario con su entropía), deja verlo y descargarlo.
- **Huellas para la cadena de custodia**: SHA-256 (WebCrypto) y MD5 (implementación propia, probada con la RFC 1321), con un campo para comparar contra un hash dado.
- **Visor hexadecimal** con la firma, el marcador de fin y los datos añadidos resaltados.
- **EXIF básico** de JPG, con aviso si la foto trae coordenadas GPS.
- Veredicto tipo videojuego: **LIMPIA**, **RARA** o **¡SOSPECHOSA!**

La página `/proceso/` cuenta de dónde sale: el laboratorio de esteganografía de Mario, los apuntes de clase sobre inicio y fin de archivo, y el caso público «The Rhino Hunt» (NIST CFReDS) que resolvieron Mario y David con Autopsy, PhotoRec, Wireshark, md5sum y jpseek.

## Uso

```bash
python3 -m http.server 8000   # y abre http://localhost:8000
node --test                   # pruebas: firmas, fin de JPG/PNG/GIF/PDF/ZIP, MD5, apéndice, EXIF
```

Sin dependencias ni paso de compilación; se publica tal cual en GitHub Pages. La política de seguridad de la página (CSP) solo permite conexiones a su propio sitio.

### Imágenes de ejemplo

`ejemplos/limpia.png` y `ejemplos/sospechosa.jpg` (con EXIF, un GPS de ejemplo en un lugar público y un ZIP pegado tras `FF D9`) se generan, siempre iguales, con:

```bash
uv run --with pillow python scripts/generar_ejemplos.py
```

## Limitaciones

No detecta esteganografía LSB ni la de herramientas como jphide, que esconden datos dentro de los píxeles o de los coeficientes comprimidos sin dejar bytes de más. Más detalles en `/proceso/`.

## Uso ético

Analiza solo archivos tuyos o que tengas permiso de revisar (Ley 1273 de 2009, art. 269A).

## Créditos

[Mario Puerta](https://github.com/ale0009) (github.com/ale0009) × [David Rincón «Kuronoma»](https://www.linkedin.com/in/davidalexanderrinconcorredorkuronoma/) (LinkedIn). Licencia MIT.
