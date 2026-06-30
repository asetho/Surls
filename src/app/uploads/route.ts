function notFound(method: "GET" | "HEAD") {
  return new Response(method === "HEAD" ? null : "Not found", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    },
    status: 404
  });
}

export function GET() {
  return notFound("GET");
}

export function HEAD() {
  return notFound("HEAD");
}
