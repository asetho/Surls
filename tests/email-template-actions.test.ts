import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => new Map<string, unknown>());
const appSetting = vi.hoisted(() => ({
  findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
    rows.has(where.key) ? { key: where.key, value: rows.get(where.key) } : null),
  upsert: vi.fn(async ({ where, create }: { where: { key: string }; create: { value: unknown } }) => {
    rows.set(where.key, create.value);
  }),
  deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
    rows.delete(where.key);
  })
}));
const auth = vi.hoisted(() => ({ requireSiteAdmin: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrf: vi.fn() }));
const delivery = vi.hoisted(() => ({ sendEmailTemplatePreview: vi.fn() }));
const rate = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { appSetting } }));
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/profile-email", () => delivery);
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/audit", () => audit);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { EMAIL_TEMPLATES } from "@/lib/email-templates";
import {
  restoreEmailTemplateAction, saveEmailTemplateAction, sendEmailTemplatePreviewAction
} from "@/app/admin/settings/email/templates/actions";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    csrf: "valid", templateId: "emailChange", recipient: "inbox@example.test",
    ...EMAIL_TEMPLATES.emailChange.defaults, ...overrides
  })) data.set(key, value);
  return data;
}

describe("email template actions", () => {
  beforeEach(() => {
    rows.clear(); vi.clearAllMocks();
    auth.requireSiteAdmin.mockResolvedValue({ id: "admin_1" });
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("sends the unsaved draft to the chosen recipient within the shared test limit", async () => {
    const data = form({ subject: "Draft subject" });
    expect(await sendEmailTemplatePreviewAction(data)).toMatchObject({ ok: true });
    expect(delivery.sendEmailTemplatePreview).toHaveBeenCalledWith("inbox@example.test", "emailChange", {
      subject: "Draft subject", text: EMAIL_TEMPLATES.emailChange.defaults.text, html: EMAIL_TEMPLATES.emailChange.defaults.html
    });
    expect(rate.checkRateLimit).toHaveBeenCalledWith("smtp:test:admin_1", 10, 15 * 60 * 1000);
    expect(appSetting.upsert).not.toHaveBeenCalled();
  });

  it("rejects invalid recipients and missing security placeholders before sending", async () => {
    expect(await sendEmailTemplatePreviewAction(form({ recipient: "invalid" }))).toMatchObject({ ok: false });
    expect(await sendEmailTemplatePreviewAction(form({ text: "Code omitted" }))).toMatchObject({ ok: false });
    expect(delivery.sendEmailTemplatePreview).not.toHaveBeenCalled();
    expect(rate.checkRateLimit).not.toHaveBeenCalled();
  });

  it("enforces the shared delivery limit and rejects unknown template IDs", async () => {
    rate.checkRateLimit.mockResolvedValueOnce({ allowed: false });
    expect(await sendEmailTemplatePreviewAction(form())).toMatchObject({ ok: false, message: expect.stringContaining("Too many") });
    expect(await saveEmailTemplateAction(form({ templateId: "smtp:test:other-admin" }))).toMatchObject({ ok: false });
    expect(delivery.sendEmailTemplatePreview).not.toHaveBeenCalled();
    expect(appSetting.upsert).not.toHaveBeenCalled();
  });

  it("rejects an expired form or signed-out user before saving or sending", async () => {
    csrf.validateCsrf.mockImplementationOnce(() => { throw new Error("expired"); });
    expect(await saveEmailTemplateAction(form())).toMatchObject({ ok: false });
    auth.requireSiteAdmin.mockResolvedValueOnce(null);
    expect(await sendEmailTemplatePreviewAction(form())).toMatchObject({ ok: false });
    expect(appSetting.upsert).not.toHaveBeenCalled();
    expect(delivery.sendEmailTemplatePreview).not.toHaveBeenCalled();
  });

  it("saves and restores only the selected template", async () => {
    expect(await saveEmailTemplateAction(form({ subject: "Custom subject" }))).toMatchObject({ ok: true });
    expect(rows.get("emailTemplate:emailChange")).toMatchObject({ subject: "Custom subject" });
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({ entityId: "emailTemplate:emailChange" }));
    expect(await restoreEmailTemplateAction(form())).toMatchObject({ ok: true, content: EMAIL_TEMPLATES.emailChange.defaults });
    expect(rows.has("emailTemplate:emailChange")).toBe(false);
  });
});
