# Is something hidden in this image?

Drop a photo (or any file) and the tool checks it **without uploading it anywhere**:

- **Magic signature vs. extension**: does that `.jpg` really start with `FF D8 FF`? Recognises JPG, PNG, GIF, PDF, ZIP/DOCX, WebP, BMP, RAR, 7-Zip, GZIP, TIFF, ICO, MP3, OLE, EXE and ELF.
- **Bytes after the end**: walks the structure (JPEG segments up to `FF D9`, PNG chunks up to `IEND`, GIF up to `3B`, a PDF's last `%%EOF`, the ZIP end-of-directory record). Anything left over is identified (ZIP, text, another file, binary with its entropy) and can be viewed and downloaded.
- **Chain-of-custody fingerprints**: SHA-256 (WebCrypto) and MD5 (own implementation, tested against RFC 1321), plus a field to compare against a given hash.
- **Hex viewer** highlighting the signature, the end marker and the appended data.
- **Basic EXIF** for JPG, warning when the photo carries GPS coordinates.
- Game-style verdict: **LIMPIA** (clean), **RARA** (odd) or **¡SOSPECHOSA!** (suspicious).

The `/proceso/` page (Spanish) tells where it comes from: Mario's steganography lab, class notes on file headers and footers, and the public case "The Rhino Hunt" (NIST CFReDS) that Mario and David solved with Autopsy, PhotoRec, Wireshark, md5sum and jpseek.

## Usage

```bash
python3 -m http.server 8000   # then open http://localhost:8000
node --test
```

No dependencies, no build step; deploys as-is to GitHub Pages. The page's CSP only allows connections to its own origin.

Example images are generated reproducibly with `uv run --with pillow python scripts/generar_ejemplos.py`.

## Limitations

It does not detect LSB steganography or tools like jphide, which hide data inside pixels or compressed coefficients without leaving extra bytes.

## Ethical use

Only analyse files that are yours or that you are authorised to examine.

## Credits

[Mario Puerta](https://github.com/ale0009) (github.com/ale0009) × [David Rincón «Kuronoma»](https://www.linkedin.com/in/davidalexanderrinconcorredorkuronoma/) (LinkedIn). MIT licence.
