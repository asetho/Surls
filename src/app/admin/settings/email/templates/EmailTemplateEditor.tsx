"use client";

import { useRef, useState, useTransition } from "react";
import type { EmailTemplateContent, EmailTemplateId } from "@/lib/email-templates";
import { restoreEmailTemplateAction, saveEmailTemplateAction, sendEmailTemplatePreviewAction } from "./actions";

type EditorProps = {
  id: EmailTemplateId;
  label: string;
  description: string;
  required: readonly string[];
  initialContent: EmailTemplateContent;
  initiallyCustomized: boolean;
  csrf: string;
  recipient: () => string;
  validateRecipient: () => boolean;
  smtpConfigured: boolean;
  open: boolean;
};

export function EmailTemplateEditor(props: EditorProps) {
  const { id, label, description, required, initialContent, initiallyCustomized, csrf, recipient, validateRecipient, smtpConfigured, open } = props;
  const form = useRef<HTMLFormElement>(null);
  const [content, setContent] = useState(initialContent);
  const [customized, setCustomized] = useState(initiallyCustomized);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function formData() {
    return form.current ? new FormData(form.current) : null;
  }

  function save() {
    if (!form.current?.reportValidity()) return;
    const data = formData();
    if (!data) return;
    setResult(null);
    startTransition(async () => {
      try {
        const response = await saveEmailTemplateAction(data);
        if (response.ok) setCustomized(true);
        setResult(response);
      } catch {
        setResult({ ok: false, message: "Could not save the email template. Please try again." });
      }
    });
  }

  function restore() {
    if (!window.confirm(`Restore the default ${label} template? This replaces the saved version and any unsaved edits.`)) return;
    const data = formData();
    if (!data) return;
    setResult(null);
    startTransition(async () => {
      try {
        const response = await restoreEmailTemplateAction(data);
        if (response.ok && response.content) {
          setContent(response.content);
          setCustomized(false);
        }
        setResult(response);
      } catch {
        setResult({ ok: false, message: "Could not restore the default template. Please try again." });
      }
    });
  }

  function sendPreview() {
    if (!validateRecipient() || !form.current?.reportValidity()) return;
    const data = formData();
    if (!data) return;
    data.set("recipient", recipient());
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await sendEmailTemplatePreviewAction(data));
      } catch {
        setResult({ ok: false, message: "Could not send the preview. Please try again." });
      }
    });
  }

  return (
    <details className="surface settings-collapse email-template-card" open={open}>
      <summary className="settings-card-header">
        <h2>{label}</h2>
        <span className={customized ? "status-pill status-pill-active" : "status-pill"}>{customized ? "Custom" : "Default"}</span>
      </summary>
      <div className="settings-collapse-body">
        <p className="muted small">{description} {required.length ? `Include ${required.map((name) => `{{${name}}}`).join(" and ")} in both message bodies.` : "This message has no placeholders."}</p>
        <form ref={form} className="form-stack email-template-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="templateId" value={id} />
          <label>Subject
            <input name="subject" required maxLength={200} value={content.subject}
              onChange={(event) => { setContent({ ...content, subject: event.target.value }); setResult(null); }} />
          </label>
          <label>Plain-text version
            <textarea name="text" required maxLength={12000} rows={7} value={content.text}
              onChange={(event) => { setContent({ ...content, text: event.target.value }); setResult(null); }} />
          </label>
          <label>HTML version
            <textarea name="html" required maxLength={24000} rows={9} value={content.html}
              onChange={(event) => { setContent({ ...content, html: event.target.value }); setResult(null); }} />
          </label>
          <div className="row-actions">
            <button type="submit" disabled={pending}>{pending ? "Working…" : "Save template"}</button>
            <button className="secondary" type="button" onClick={sendPreview} disabled={pending || !smtpConfigured}>{pending ? "Working…" : "Send preview"}</button>
            <button className="secondary" type="button" onClick={restore} disabled={pending}>Restore default</button>
          </div>
          {result ? <p role={result.ok ? "status" : "alert"} className="small">{result.message}</p> : null}
        </form>
      </div>
    </details>
  );
}
