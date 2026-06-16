export type UserProfileInput = {
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
  email: FormDataEntryValue | null | string;
  name: FormDataEntryValue | null | string;
}): UserProfileValidation {
  const email = String(input.email ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim() || null;

  if (!email || !EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (name && name.length > 120) {
    return { error: "Display names must be 120 characters or fewer." };
  }

  return { data: { email, name } };
}

export function normalizeUserProfileFormData(formData: FormData): UserProfileValidation {
  return normalizeUserProfileInput({
    email: formData.get("email"),
    name: formData.get("name")
  });
}
