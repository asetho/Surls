const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#087e8b"/>
  <path d="M19 34a9 9 0 0 1 0-13l5-5a9 9 0 0 1 13 13l-2 2" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
  <path d="M45 30a9 9 0 0 1 0 13l-5 5a9 9 0 0 1-13-13l2-2" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
</svg>`;

export function GET() {
  return new Response(favicon, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "image/svg+xml; charset=utf-8"
    }
  });
}
