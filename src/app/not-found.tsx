import Link from "next/link";

export default function NotFound() {
  return (
    <main className="section">
      <div className="container">
        <div className="surface surface-panel not-found-panel">
          <h1>Not found</h1>
          <p className="muted">That app route does not exist.</p>
          <div className="row-actions">
            <Link className="button" href="/">Go home</Link>
            <Link className="button secondary" href="/admin/links">Browse links</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
