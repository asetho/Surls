// Optional ChatGPT desktop-browser entry point. Default DOM picking stays intact.
(() => {
  const id = "surls-annotation-toggle";
  if (document.getElementById(id)) return;
  const button = document.createElement("button");
  button.id = id;
  button.className = "surls-annotation-toggle";
  button.type = "button";
  button.hidden = true;
  button.title = "Annotate with ChatGPT. Hold Space to use page controls while annotating.";
  document.body.append(button);

  const api = () => {
    const annotation = document.oai?.annotation;
    return typeof annotation?.toggle === "function" && typeof annotation?.isActive === "function"
      ? annotation : null;
  };
  const render = () => {
    let active = false;
    try {
      const annotation = api();
      button.hidden = !annotation;
      active = annotation ? annotation.isActive() : false;
    } catch {
      button.hidden = true;
    }
    button.textContent = active ? "Exit annotation mode" : "Annotate with ChatGPT";
    button.setAttribute("aria-pressed", String(active));
  };
  button.addEventListener("click", () => {
    try {
      const annotation = api();
      // Keep the browser's live user activation; accepted is not confirmed state.
      if (annotation) annotation.toggle(!annotation.isActive());
      render();
    } catch {
      button.hidden = true;
      button.setAttribute("aria-pressed", "false");
    }
  });
  document.addEventListener("oaiannotationmodechange", render);
  window.addEventListener("pageshow", render);
  render();
})();
