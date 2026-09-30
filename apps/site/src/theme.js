const key = "surls-site-theme";
const root = document.documentElement;
const media = matchMedia("(prefers-color-scheme: dark)");
let choice = "auto";
try {
  const saved = localStorage.getItem(key);
  if (saved === "light" || saved === "dark") choice = saved;
} catch {}
function apply() {
  const theme = choice === "auto" ? (media.matches ? "dark" : "light") : choice;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "dark" ? "#061d2b" : "#f2f5f7");
  const button = document.querySelector("[data-theme-toggle]");
  if (button) {
    button.setAttribute("aria-label", `Color theme: ${choice}. Switch to ${choice === "light" ? "system" : choice === "auto" ? "dark" : "light"}.`);
  }
}
apply();
document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  choice = choice === "light" ? "auto" : choice === "auto" ? "dark" : "light";
  try { choice === "auto" ? localStorage.removeItem(key) : localStorage.setItem(key, choice); } catch {}
  apply();
});
media.addEventListener("change", () => { if (choice === "auto") apply(); });
