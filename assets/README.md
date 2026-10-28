# ReFind branding

The SVG masters reconstruct the logo references supplied by the project owner on 28 October 2026. The symbol and wordmark are outlined vector paths, with a smooth blue/cyan gradient and transparent backgrounds. No font download is required. The source references were low-resolution raster images; the vectors preserve their design while smoothing the contours.

| Asset | Use |
|---|---|
| `refind-logo-horizontal.svg` | Header master, intrinsic size 344 × 108; displayed at 144px on desktop and 124px on mobile |
| `refind-logo-horizontal.png` | Transparent fallback, 688 × 216 |
| `refind-logo-horizontal-dark.svg`, `refind-logo-horizontal-dark.png` | Same geometry and symbol gradient, with a light `#EAF0FF` wordmark for dark surfaces |
| `refind-logo-mark.svg` | Standalone symbol and SVG favicon |
| `refind-logo-mark.png` | Transparent symbol export, 256 × 256 |
| `refind-favicon-16.png`, `refind-favicon-32.png`, `refind-favicon-48.png` | Small transparent favicon exports; page templates include the 32px fallback |
| `refind-shortcut.svg` | Rounded white tile master with a soft shadow |
| `refind-shortcut-180.png`, `refind-shortcut-512.png` | Square shortcut exports; page templates use the 180px touch icon |

The symbol uses `#1466FC`, `#0BA7F6`, and `#02CFF1`; the light-theme wordmark uses `#10203E`. Interface controls use the quieter `#3F5FB5` blue in light mode and `#9BB3FF` in dark mode, defined in `css/theme.css`. Light-mode text links use the stronger `#344F99` for contrast over pastel backgrounds. The shared header selects the appropriate wordmark without changing its dimensions.

Regenerate the PNG exports from the project root with `node tools/export-branding.cjs`. As with the existing browser tooling, set `REFIND_PLAYWRIGHT_MODULE` to an installed Playwright/Playwright Core module and, if needed, `REFIND_CHROME` to the Chrome executable. Existing PNG files are replaced; the SVG masters are retained.
