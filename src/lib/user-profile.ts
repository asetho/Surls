import { requireOptionalDisplayTimeZone } from "./dates";

export type UserProfileInput = {
  displayTimeZone: string | null;
  email: string;
  name: string | null;
};

export type UserProfileValidation =
  | {
      data: UserProfileInput;
      error?: never;
    }
  | {
      data?: never;
      error: string;
    };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUserProfileInput(input: {
  displayTimeZone?: FormDataEntryValue | null | string;
  email: FormDataEntryValue | null | string;
  name: FormDataEntryValue | null | string;
}): UserProfileValidation {
  let displayTimeZone: string | null;
  const email = String(input.email ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim() || null;

  try {
    displayTimeZone = requireOptionalDisplayTimeZone(input.displayTimeZone);
  } catch {
    return { error: "Choose a valid display timezone." };
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (email.length > 320) {
    return { error: "Email addresses must be 320 characters or fewer." };
  }

  if (name && name.length > 120) {
    return { error: "Display names must be 120 characters or fewer." };
  }

  return { data: { displayTimeZone, email, name } };
}

export function normalizeUserProfileFormData(formData: FormData): UserProfileValidation {
  return normalizeUserProfileInput({
    displayTimeZone: formData.get("displayTimeZone"),
    email: formData.get("email"),
    name: formData.get("name")
  });
}
