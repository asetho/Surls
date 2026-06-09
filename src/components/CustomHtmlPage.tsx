export function CustomHtmlPage({ html }: { html: string }) {
  return <main className="custom-html-page" dangerouslySetInnerHTML={{ __html: html }} />;
}
