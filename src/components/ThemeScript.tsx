import Script from "next/script";

export function ThemeScript() {
  const script = `
    (() => {
      const key = "surls-theme";
      const stored = localStorage.getItem(key) || "auto";
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = (choice) => {
        const resolved = choice === "auto" ? (media.matches ? "dark" : "light") : choice;
        document.documentElement.dataset.themeChoice = choice;
        document.documentElement.dataset.theme = resolved;
      };
      apply(stored);
      media.addEventListener?.("change", () => {
        if ((localStorage.getItem(key) || "auto") === "auto") apply("auto");
      });
    })();
  `;

  return <Script id="surls-theme-script" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: script }} />;
}
