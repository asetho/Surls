const key = "surls-site-theme";
const root = document.documentElement;
const media = matchMedia("(prefers-color-scheme: dark)");
const sharedCookie = "surls-public-theme";
const sharedHost = location.hostname === "surls.dev" || location.hostname === "docs.surls.dev";
function readSharedTheme() {
  if (!sharedHost) return null;
  const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${sharedCookie}=`));
  const theme = cookie?.slice(sharedCookie.length + 1);
  return theme === "light" || theme === "dark" ? theme : null;
}
function writeSharedTheme(theme) {
  if (sharedHost) document.cookie = `${sharedCookie}=${theme}; Domain=surls.dev; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}
let choice = readSharedTheme();
try {
  const saved = localStorage.getItem(key);
  if (!choice && (saved === "light" || saved === "dark")) {
    choice = saved;
    writeSharedTheme(choice);
  } else if (choice && choice !== saved) {
    localStorage.setItem(key, choice);
  }
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
  writeSharedTheme(choice);
  apply();
});
media.addEventListener("change", () => { if (choice === null) apply(); });
function syncSharedTheme() {
  const theme = readSharedTheme();
  if (theme && theme !== choice) {
    choice = theme;
    try { localStorage.setItem(key, theme); } catch {}
    apply();
  }
}
window.addEventListener("focus", syncSharedTheme);
document.addEventListener("visibilitychange", () => { if (!document.hidden) syncSharedTheme(); });
setInterval(syncSharedTheme, 1500);
