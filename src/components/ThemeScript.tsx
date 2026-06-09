export function ThemeScript() {
  const script = `
    (() => {
      const key = "surls-theme";
      const valid = (value) => value === "light" || value === "dark" || value === "auto";
      const storedChoice = () => {
        try {
          const value = localStorage.getItem(key);
          if (valid(value)) return value;
        } catch {}
        return null;
      };
      const cookie = document.cookie.match(/(?:^|;\\s*)surls-theme=([^;]+)/);
      const cookieChoice = cookie ? decodeURIComponent(cookie[1]) : null;
      const stored = storedChoice() || (valid(cookieChoice) ? cookieChoice : "auto");
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = (choice) => {
        const resolved = choice === "auto" ? (media.matches ? "dark" : "light") : choice;
        document.documentElement.dataset.themeChoice = choice;
        document.documentElement.dataset.theme = resolved;
      };
      apply(stored);
      media.addEventListener?.("change", () => {
        if ((storedChoice() || cookieChoice || "auto") === "auto") apply("auto");
      });
    })();
  `;

  return <script id="surls-theme-script" dangerouslySetInnerHTML={{ __html: script }} />;
}
