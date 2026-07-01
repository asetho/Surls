const root = document.documentElement;
const modeButton = document.querySelector("[data-mode-toggle]");
const viewportButtons = document.querySelectorAll("[data-viewport]");

modeButton?.addEventListener("click", () => {
  const dark = root.dataset.mode !== "dark";
  root.dataset.mode = dark ? "dark" : "light";
  modeButton.textContent = dark ? "Light mode" : "Dark mode";
});

for (const button of viewportButtons) {
  button.addEventListener("click", () => {
    root.dataset.viewport = button.dataset.viewport;
    for (const candidate of viewportButtons) {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    }
  });
}
