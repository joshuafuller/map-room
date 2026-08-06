# Third-party notices

## OpenStreetMap Americana

Map Room packages the generated StyleJSON, sprite atlas, shield definitions,
and shield-rendering runtime from
[OpenStreetMap Americana](https://github.com/osm-americana/openstreetmap-americana)
at commit `6098606aae8119de34a5de08e7bedc1ffdd712a8`. OpenStreetMap Americana is
dedicated to the public domain under CC0-1.0. Map Room preserves its actual
layer hierarchy and visual assets while rewriting the tile, sprite, glyph, and
shield locations to self-hosted Map Room resources. Americana font families
are mapped to Map Room's locally packaged Open Sans glyphs, and its external
terrain source is omitted so the style remains usable on offline networks.

The complete upstream license text and provenance record are included under
`styles/vendor/americana/`.

## MapLibre GL JS

Map Room's browser setup copies MapLibre GL JS, version 6.1.0, into the local
runtime bundle. MapLibre GL JS is distributed under the BSD 3-Clause License
and includes code under additional compatible notices. The setup command copies
the dependency's complete `LICENSE.txt` alongside the browser bundle as
`web/vendor/MapLibre-LICENSE.txt`.

Copyright (c) 2023, MapLibre contributors

## Open Sans

Map Room's setup command installs pre-generated Open Sans glyph PBFs used by
its map styles. Open Sans is distributed under the SIL Open Font License 1.1.
The canonical font sources and license are published by the
[Open Sans project](https://github.com/googlefonts/opensans).

## Lucide Icons

Map Room's generated POI sprite atlas incorporates selected SVG icons from
[Lucide](https://lucide.dev/), version 1.28.0. Lucide is distributed under the
ISC License; some icons are derived from Feather under the MIT License.

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

## QR Code Generator

Map Room's browser setup copies QR Code Generator for JavaScript, version 2.0.4,
into the local runtime bundle. It is distributed under the MIT License.

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## jsQR

Map Room's browser test suite uses jsQR, version 1.4.0, to decode the QR image
rendered by Chromium and verify its exact contents. jsQR is a development-only
dependency distributed under the Apache License 2.0.

## Sharp

The sprite build pipeline uses [Sharp](https://sharp.pixelplumbing.com/),
version 0.35.3, under the Apache-2.0 License. Sharp is a build-time dependency;
it is not required by Map Room clients or served as a runtime asset.
