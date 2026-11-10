"""Genera las dos imágenes de EJEMPLO de la herramienta (reproducible).

Uso (desde la raíz del repo):
    uv run --with pillow python scripts/generar_ejemplos.py

Produce:
    ejemplos/limpia.png       PNG normal: termina justo en el bloque IEND.
    ejemplos/sospechosa.jpg   JPG con EXIF (incluye GPS de ejemplo: Plaza de Bolívar,
                              Bogotá, un lugar público) y un ZIP pegado DESPUÉS del
                              marcador de fin FFD9, como en el laboratorio de
                              esteganografía por concatenación.

Las imágenes son dibujos geométricos hechos aquí; no usan arte de terceros.
"""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "ejemplos"

PAPEL = (249, 249, 247)
TINTA = (10, 9, 10)
ROJO = (203, 67, 62)
CIAN = (67, 143, 184)

ANCHO, ALTO = 480, 320

MENSAJE = (
    "MENSAJE DE EJEMPLO\n"
    "Este texto viaja escondido en un ZIP pegado despues del marcador FFD9\n"
    "de sospechosa.jpg. Los visores de imagenes lo ignoran: solo leen hasta FFD9.\n"
    "Lo genero scripts/generar_ejemplos.py para probar la herramienta.\n"
)


def fuente(tam: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=tam)
    except TypeError:  # Pillow antiguo
        return ImageFont.load_default()


def vineta(etiqueta: str, acento: tuple[int, int, int]) -> Image.Image:
    """Una viñeta 'tinta y trama': trama de puntos, sol, montañas y un rótulo EJEMPLO."""
    img = Image.new("RGB", (ANCHO, ALTO), PAPEL)
    d = ImageDraw.Draw(img)
    for y in range(6, ALTO, 12):
        for x in range(6 + (y // 12 % 2) * 6, ANCHO, 12):
            d.ellipse((x - 1, y - 1, x + 1, y + 1), fill=(205, 204, 198))
    d.ellipse((330, 40, 420, 130), fill=acento, outline=TINTA, width=4)
    d.polygon([(0, 300), (140, 120), (250, 300)], fill=CIAN, outline=TINTA)
    d.polygon([(150, 300), (300, 150), (480, 300)], fill=TINTA)
    d.rectangle((0, 286, ANCHO, ALTO), fill=TINTA)
    d.rectangle((16, 16, 214, 66), fill=PAPEL, outline=TINTA, width=4)
    d.text((28, 22), "EJEMPLO", fill=TINTA, font=fuente(34))
    d.text((18, 292), etiqueta, fill=PAPEL, font=fuente(20))
    d.rectangle((0, 0, ANCHO - 1, ALTO - 1), outline=TINTA, width=6)
    return img


def zip_mensaje() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        info = zipfile.ZipInfo("mensaje.txt", date_time=(2025, 4, 24, 10, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, MENSAJE.encode("utf-8"))
    return buf.getvalue()


def gps_dms(grados: float) -> tuple[float, float, float]:
    g = int(grados)
    m_total = (grados - g) * 60
    m = int(m_total)
    s = round((m_total - m) * 60, 2)
    return (float(g), float(m), s)


def main() -> None:
    SALIDA.mkdir(exist_ok=True)

    # 1) Limpia: PNG sin nada después de IEND.
    vineta("limpia.png  ·  sin datos escondidos", CIAN).save(
        SALIDA / "limpia.png", optimize=False
    )

    # 2) Sospechosa: JPG con EXIF + GPS de ejemplo + ZIP pegado al final.
    exif = Image.Exif()
    exif[0x010F] = "Ejemplo"  # Make
    exif[0x0110] = "Imagen generada por script"  # Model
    exif[0x0131] = "generar_ejemplos.py"  # Software
    exif[0x0132] = "2025:04:24 10:00:00"  # DateTime
    gps = exif.get_ifd(0x8825)
    gps[1] = "N"
    gps[2] = gps_dms(4.5981)  # Plaza de Bolívar, Bogotá (lugar público, de ejemplo)
    gps[3] = "W"
    gps[4] = gps_dms(74.0760)
    buf = io.BytesIO()
    vineta("sospechosa.jpg  ·  trae un ZIP pegado", ROJO).save(
        buf, "JPEG", quality=85, exif=exif.tobytes()
    )
    jpg = buf.getvalue()
    assert jpg.endswith(b"\xff\xd9"), "el JPG debe terminar en FFD9 antes de pegar"
    (SALIDA / "sospechosa.jpg").write_bytes(jpg + zip_mensaje())

    for nombre in ("limpia.png", "sospechosa.jpg"):
        print(f"{nombre}: {(SALIDA / nombre).stat().st_size} bytes")


if __name__ == "__main__":
    main()
