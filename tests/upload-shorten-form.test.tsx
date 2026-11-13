import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UploadShortenForm } from "@/components/ToolsForms";

describe("upload form", () => {
  it("keeps the CSRF token out of the multipart body", () => {
    const markup = renderToStaticMarkup(<UploadShortenForm csrf="test-csrf" maxUploadLabel="No limit" />);

    expect(markup).toContain('name="file"');
    expect(markup).not.toContain('name="csrf"');
    expect(markup).not.toContain("test-csrf");
  });
});
