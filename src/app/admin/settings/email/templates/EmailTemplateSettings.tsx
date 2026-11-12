"use client";

import { useRef } from "react";
import type { EmailTemplateContent, EmailTemplateId } from "@/lib/email-templates";
import { EmailTemplateEditor } from "./EmailTemplateEditor";

type TemplateEntry = {
  id: EmailTemplateId;
  label: string;
  description: string;
  required: readonly string[];
  content: EmailTemplateContent;
  customized: boolean;
};

export function EmailTemplateSettings({ templates, csrf, smtpConfigured }: {
  templates: TemplateEntry[]; csrf: string; smtpConfigured: boolean;
}) {
  const recipientInput = useRef<HTMLInputElement>(null);
  return (
    <>
      <section className="surface surface-panel email-template-intro">
        <h2>Preview recipient</h2>
        <p className="muted small">Edit a template, then send its current text and HTML versions without saving. Previews use a sample code and an inactive reset link. Test and preview emails share a limit of 10 every 15 minutes.</p>
        <label>Recipient email
          <input ref={recipientInput} type="email" required maxLength={320} placeholder="mailbox@example.com" autoComplete="email" />
        </label>
        {!smtpConfigured ? <p className="muted small">Configure SMTP delivery on the Email settings page before sending previews.</p> : null}
      </section>
      <div className="email-template-list">
        {templates.map((template, index) => (
          <EmailTemplateEditor key={template.id} id={template.id} label={template.label} description={template.description}
            required={template.required} initialContent={template.content} initiallyCustomized={template.customized}
            csrf={csrf} recipient={() => recipientInput.current?.value ?? ""} validateRecipient={() => recipientInput.current?.reportValidity() ?? false}
            smtpConfigured={smtpConfigured} open={index === 0} />
        ))}
      </div>
    </>
  );
}
