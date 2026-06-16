import { describe, expect, it } from "vitest";
import { ADDTOANY_PRIORITIZED_SERVICES, ADDTOANY_SCRIPT_SRC } from "@/lib/addtoany";

describe("AddToAny sharing", () => {
  it("loads the universal menu script", () => {
    expect(ADDTOANY_SCRIPT_SRC).toBe("https://static.addtoany.com/menu/page.js");
  });

  it("prioritizes the requested sharing services", () => {
    expect(ADDTOANY_PRIORITIZED_SERVICES).toEqual([
      "email",
      "sms",
      "facebook",
      "facebook_messenger",
      "linkedin",
      "instagram",
      "snapchat",
      "x",
      "reddit"
    ]);
  });
});

