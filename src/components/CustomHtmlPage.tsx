import { headers } from "next/headers";
import { CustomHtmlFrame } from "@/components/CustomHtmlFrame";
import { addNonceToCustomPageScripts } from "@/lib/custom-pages";

export async function CustomHtmlPage({ html }: { html: string }) {
  const nonce = (await headers()).get("x-nonce");
  const srcDoc = addNonceToCustomPageScripts(html, nonce);

  return (
    <main className="custom-html-page custom-html-page-isolated" data-surls-custom-page>
      <CustomHtmlFrame html={srcDoc} nonce={nonce} />
    </main>
  );
}
