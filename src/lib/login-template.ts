export const LOGIN_FORM_PLACEHOLDER = "{{LOGIN_FORM}}";
export const LOGIN_TITLE_PLACEHOLDER = "{{LOGIN_TITLE}}";
export const LOGIN_TAGLINE_PLACEHOLDER = "{{LOGIN_TAGLINE}}";

export type LoginTemplatePart =
  | { type: "html"; html: string }
  | { type: "form" }
  | { type: "title" }
  | { type: "tagline" };

const TOKEN_PATTERN = /(\{\{LOGIN_FORM\}\}|\{\{LOGIN_TITLE\}\}|\{\{LOGIN_TAGLINE\}\})/g;

function tokenType(token: string): Exclude<LoginTemplatePart["type"], "html"> {
  if (token === LOGIN_FORM_PLACEHOLDER) return "form";
  if (token === LOGIN_TITLE_PLACEHOLDER) return "title";
  return "tagline";
}

function placeholderForType(type: LoginTemplatePart["type"]) {
  if (type === "form") return LOGIN_FORM_PLACEHOLDER;
  if (type === "title") return LOGIN_TITLE_PLACEHOLDER;
  if (type === "tagline") return LOGIN_TAGLINE_PLACEHOLDER;
  return "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function escapeHtmlWithLineBreaks(value: string) {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
}

export function parseLoginTemplate(html: string) {
  const parts: LoginTemplatePart[] = [];
  const counts = { form: 0, tagline: 0, title: 0 };
  let cursor = 0;

  for (const match of html.matchAll(TOKEN_PATTERN)) {
    const token = match[0];
    const index = match.index ?? cursor;
    if (index > cursor) parts.push({ type: "html", html: html.slice(cursor, index) });

    const type = tokenType(token);
    counts[type] += 1;
    parts.push({ type });
    cursor = index + token.length;
  }

  if (cursor < html.length) parts.push({ type: "html", html: html.slice(cursor) });
  if (counts.form !== 1 || counts.title > 1 || counts.tagline > 1) return null;
  return parts;
}

export function splitLoginFormPlaceholder(html: string) {
  const parts = parseLoginTemplate(html);
  if (!parts) return null;

  const formIndex = parts.findIndex((part) => part.type === "form");
  const serialize = (part: LoginTemplatePart) => (part.type === "html" ? part.html : placeholderForType(part.type));
  return {
    after: parts.slice(formIndex + 1).map(serialize).join(""),
    before: parts.slice(0, formIndex).map(serialize).join("")
  };
}

export function validateLoginPageTemplate(html: string) {
  if (!parseLoginTemplate(html)) {
    throw new Error(
      `Custom login pages must include exactly one ${LOGIN_FORM_PLACEHOLDER} placeholder. Optional ${LOGIN_TITLE_PLACEHOLDER} and ${LOGIN_TAGLINE_PLACEHOLDER} placeholders may be used once each.`
    );
  }
}

export function renderLoginTemplateHtml(html: string, { tagline, title }: { tagline: string; title: string }) {
  const parts = parseLoginTemplate(html);
  if (!parts) return null;

  return parts
    .map((part) => {
      if (part.type === "html") return part.html;
      if (part.type === "form") return '<div data-surls-login-form-slot></div>';
      if (part.type === "title") return escapeHtml(title);
      return escapeHtmlWithLineBreaks(tagline);
    })
    .join("");
}
