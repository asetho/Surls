"use client";

import { useEffect } from "react";

function isTitleAutoFillForm(form: HTMLFormElement) {
  return form.dataset.titleAutofill === "true";
}

function shouldFillTitle(titleInput: HTMLInputElement) {
  return !titleInput.value.trim() || titleInput.dataset.autoFilled === "true";
}

export function TitleAutoFill() {
  useEffect(() => {
    const controllers: AbortController[] = [];
    const cleanups: Array<() => void> = [];

    for (const form of Array.from(document.querySelectorAll<HTMLFormElement>("form[data-title-autofill]"))) {
      if (!isTitleAutoFillForm(form)) continue;
      const destinationInput = form.elements.namedItem("destinationUrl");
      const titleInput = form.elements.namedItem("title");
      if (!(destinationInput instanceof HTMLInputElement) || !(titleInput instanceof HTMLInputElement)) continue;

      const fill = async () => {
        const destination = destinationInput.value.trim();
        if (!destination || !shouldFillTitle(titleInput)) return;

        const controller = new AbortController();
        controllers.push(controller);
        titleInput.dataset.autoLoading = "true";

        try {
          const response = await fetch(`/api/page-title?url=${encodeURIComponent(destination)}`, {
            signal: controller.signal
          });
          if (!response.ok || !shouldFillTitle(titleInput)) return;
          const payload = (await response.json()) as { title?: string | null };
          if (!payload.title) return;
          titleInput.value = payload.title;
          titleInput.dataset.autoFilled = "true";
        } catch {
          return;
        } finally {
          delete titleInput.dataset.autoLoading;
        }
      };

      const markManualTitle = () => {
        if (titleInput.value.trim()) titleInput.dataset.autoFilled = "false";
      };

      destinationInput.addEventListener("blur", fill);
      destinationInput.addEventListener("change", fill);
      titleInput.addEventListener("input", markManualTitle);
      void fill();

      cleanups.push(() => {
        destinationInput.removeEventListener("blur", fill);
        destinationInput.removeEventListener("change", fill);
        titleInput.removeEventListener("input", markManualTitle);
      });
    }

    return () => {
      for (const controller of controllers) controller.abort();
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return null;
}
