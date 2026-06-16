(() => {
  const key = "surls-theme";
  const fallbackThemeColor = "#e9f2f6";
  const valid = (value) => value === "light" || value === "dark" || value === "auto";
  const storedChoice = () => {
    try {
      const value = localStorage.getItem(key);
      if (valid(value)) return value;
    } catch {}
    return null;
  };
  const cookie = document.cookie.match(/(?:^|;\s*)surls-theme=([^;]+)/);
  const cookieChoice = cookie ? decodeURIComponent(cookie[1]) : null;
  const stored = storedChoice() || (valid(cookieChoice) ? cookieChoice : "auto");
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const cssColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const resolvedTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  const activeDashboardBackground = () => cssColor(`--dashboard-${resolvedTheme()}-background`) || fallbackThemeColor;
  const themeMetaTags = () => Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  const updateThemeColor = () => {
    const color = activeDashboardBackground();
    const metas = themeMetaTags();
    if (!metas.length) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = color;
      document.head.appendChild(meta);
      return;
    }
    for (const meta of metas) {
      meta.content = color;
    }
  };
  const apply = (choice) => {
    const resolved = choice === "auto" ? (media.matches ? "dark" : "light") : choice;
    document.documentElement.dataset.themeChoice = choice;
    document.documentElement.dataset.theme = resolved;
    updateThemeColor();
  };
  apply(stored);
  media.addEventListener?.("change", () => {
    if ((storedChoice() || cookieChoice || "auto") === "auto") apply("auto");
  });
  new MutationObserver(updateThemeColor).observe(document.documentElement, {
    attributeFilter: ["data-theme", "style"]
  });
  new MutationObserver(updateThemeColor).observe(document.body, {
    childList: true,
    subtree: true
  });
})();
