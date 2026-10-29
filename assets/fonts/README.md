# Manrope for ReFind

Manrope is self-hosted from the Google Fonts OFL distribution. The supplied outlined ReFind wordmark is unchanged. The app uses upright weights 400, 500, 600 and 700 from a variable font; other scripts and emoji retain system fallbacks.

- Source: https://github.com/google/fonts/tree/main/ofl/manrope
- Original font: https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf
- License: [SIL Open Font License 1.1](Manrope-OFL.txt), retained with the font.
- Downloaded 28 October 2026; source SHA-256: `3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6`.
- Converted without subsetting to WOFF2 with FontTools/Brotli; WOFF2 SHA-256: `f6e9dbee754edc29a78638c9dc375582cd3854a0573a365b480af20f7e9d4dd5` (53,672 bytes). The original variable weight range is 200–800; the application declares 400–700.

Conversion dependencies and original TTF are local build artifacts under ignored `output/playwright/font-build/`. The website requests only the bundled WOFF2; it contacts no external font service.
