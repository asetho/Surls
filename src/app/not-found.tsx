import { BackButton } from "@/components/BackButton";
import { PublicHeader } from "./layout";
import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <PublicHeader />
      <main className="section">
        <div className="container">
          <div className="surface" style={{ padding: "1.25rem", maxWidth: "680px" }}>
            <h1>That short URL was not found.</h1>
            <p className="muted">The link may have been removed, mistyped, disabled, or never created.</p>
            <div className="row-actions">
              <BackButton />
              <Link className="button secondary" href="/">
                Go home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
