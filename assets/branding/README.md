# Surls S-links logo

Refined from the selected S-links concept on September 30, 2026.

## Deliverables

| Variant | Adobe Illustrator | SVG | Transparent PNG |
| --- | --- | --- | --- |
| Symbol | `surls-s-links-mark.ai` | `surls-s-links-mark.svg` | `surls-s-links-mark.png` — 2048 × 2048 |
| Symbol with Surls name | `surls-s-links-lockup.ai` | `surls-s-links-lockup.svg` | `surls-s-links-lockup.png` — 3000 × 882 |

The Illustrator and SVG files contain editable vector outlines. The wordmark is outlined and does not require a font. The symbol has two paths; the full logo has seven. The preview sheet shows white and pale blue brand surfaces; the SVG and PNG logos have transparent backgrounds.

## Refinements and provenance

- Matched the upper and lower link geometry using the same outline rotated 180 degrees.
- Smoothed the curves and cleaned the diagonal gap through the center.
- Preserved the selected wordmark, traced and expanded in Adobe Illustrator.
- Matched the site palette: navy `#015A85` and teal `#0488A5`. Dark surfaces use ice blue `#C6E6F5` for the upper link and lettering, with the original teal `#0488A5` below. No logo backing is needed.
- Saved native, PDF-compatible `.ai` documents in Adobe Illustrator 30.8 and reopened both to verify them.
- Validated SVG paths, PNG transparency, and the absence of embedded raster images in the Illustrator files.

## Source files

`source/illustrator-trace.svg` preserves the intermediate Illustrator trace. `source/build-exports.mjs` creates the refined SVGs, PNGs, and preview using the repository's existing Sharp dependency. Run it from this repository with `node assets/branding/source/build-exports.mjs`. The current SVGs are the source of truth; the historical trace is retained for provenance.

The palette-matched native `.ai` files were regenerated in Illustrator and reopened to verify their vector paths and absence of raster images. The script does not regenerate the `.ai` files. After changing the vector source, open the new SVGs in Illustrator and save updated Illustrator documents.

## Web assets

Run `node scripts/sync-branding.mjs` to copy the approved logo and locally hosted Plus Jakarta Sans fonts into the app, marketing site, and docs. The logo lettering remains editable vector outlines.

The app, marketing site, and docs use `surls-s-url-links.svg`, which combines the S mark with “urls” and includes an additional 16 vector units of spacing between them. SVG, transparent PNG, and Illustrator versions are available. The matching dark web variant is `surls-s-url-links-dark.svg`, with a transparent PNG export. Both web variants share exactly the same outlines.
