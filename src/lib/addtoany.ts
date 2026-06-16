export const ADDTOANY_SCRIPT_ID = "surls-addtoany-page";
export const ADDTOANY_SCRIPT_SRC = "https://static.addtoany.com/menu/page.js";

export const ADDTOANY_PRIORITIZED_SERVICES = [
  "email",
  "sms",
  "facebook",
  "facebook_messenger",
  "linkedin",
  // AddToAny currently treats Instagram as a follow service; unknown share services are ignored by the menu.
  "instagram",
  "snapchat",
  "x",
  "reddit"
] as const;
