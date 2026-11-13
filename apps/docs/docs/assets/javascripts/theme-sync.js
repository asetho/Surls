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

const initialTheme = readSharedTheme();
if (initialTheme && typeof __md_set === "function") {
  __md_set("__palette", {
    index: initialTheme === "dark" ? 1 : 0,
    color: {
      media: `(prefers-color-scheme: ${initialTheme})`,
      scheme: initialTheme === "dark" ? "slate" : "default",
      primary: "custom",
      accent: "custom",
    },
  });
}

function syncSharedTheme() {
  const theme = readSharedTheme();
  if (!theme || !document.body) return;
  const scheme = theme === "dark" ? "slate" : "default";
  if (document.body.dataset.mdColorScheme !== scheme) {
    document.querySelector(`input[name="__palette"][data-md-color-scheme="${scheme}"]`)?.click();
  }
}

document.addEventListener("change", (event) => {
  const input = event.target;
  if (input instanceof HTMLInputElement && input.name === "__palette") {
    writeSharedTheme(input.dataset.mdColorScheme === "slate" ? "dark" : "light");
  }
});
document.addEventListener("DOMContentLoaded", syncSharedTheme);
window.addEventListener("focus", syncSharedTheme);
document.addEventListener("visibilitychange", () => { if (!document.hidden) syncSharedTheme(); });
setInterval(syncSharedTheme, 1500);
