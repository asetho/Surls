const key = "surls-site-theme";
const root = document.documentElement;
const media = matchMedia("(prefers-color-scheme: dark)");
let choice = null;
try {
  const saved = localStorage.getItem(key);
  if (saved === "light" || saved === "dark") choice = saved;
} catch {}
function apply() {
  const theme = choice ?? (media.matches ? "dark" : "light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "dark" ? "#061d2b" : "#f2f5f7");
  const button = document.querySelector("[data-theme-toggle]");
  if (button) {
    button.querySelectorAll("[data-theme-icon]").forEach((icon) => { icon.hidden = icon.dataset.themeIcon !== theme; });
    button.setAttribute("aria-label", `Color theme: ${theme}. Switch to ${theme === "dark" ? "light" : "dark"}.`);
  }
}
apply();
document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  choice = (choice ?? (media.matches ? "dark" : "light")) === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(key, choice);
  } catch {}
  apply();
});
media.addEventListener("change", () => { if (choice === null) apply(); });
