# Surls CSS Visual Audit Preview

This is an isolated static review site for the `audit/css-visual-preview` branch.

- Source: `visual-audit-preview/src/`
- Static build: `visual-audit-preview/dist/`
- Mock data only; no production data or production service URLs.
- Proposed styles are namespaced under `.audit-after` and are not imported by the production app.

Run locally:

```sh
python3 -m http.server 4173 --directory visual-audit-preview/dist
```
