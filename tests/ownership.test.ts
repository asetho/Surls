import { describe, expect, it } from "vitest";
import { apiTokenOwnershipWhere, clickEventOwnershipWhere, shortLinkOwnershipWhere } from "@/lib/ownership";

describe("ownership predicates", () => {
  it("scopes ordinary users to their own resources", () => {
    const user = { id: "user_1", role: "USER" };

    expect(shortLinkOwnershipWhere(user)).toEqual({ createdById: "user_1" });
    expect(clickEventOwnershipWhere(user)).toEqual({ shortLink: { createdById: "user_1" } });
    expect(apiTokenOwnershipWhere(user)).toEqual({ userId: "user_1" });
  });

  it("keeps site-administrator queries global", () => {
    const admin = { id: "admin_1", role: "ADMIN" };

    expect(shortLinkOwnershipWhere(admin)).toEqual({});
    expect(clickEventOwnershipWhere(admin)).toEqual({});
    expect(apiTokenOwnershipWhere(admin)).toEqual({});
  });
});
