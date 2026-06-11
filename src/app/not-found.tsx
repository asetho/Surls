import { BackButton } from "@/components/BackButton";
import { CustomHtmlPage } from "@/components/CustomHtmlPage";
import { PublicHeader } from "./layout";
import Link from "next/link";
import { pageFromFilesystem } from "@/lib/custom-pages";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function NotFound() {
  const filesystemPage = await pageFromFilesystem("notFound");
  if (filesystemPage) {
    return <CustomHtmlPage html={filesystemPage.html} />;
  }

  const customPage = await getSetting("customNotFoundPage");
  if (customPage) {
    return <CustomHtmlPage html={customPage.html} />;
  }

  return (
    <>
      <PublicHeader />
      <main className="section">
        <div className="container">
          <div className="surface surface-panel" style={{ maxWidth: "680px" }}>
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
