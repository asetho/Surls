"use server";

import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { hashPassword } from "@/lib/password";
import { randomToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { userUploadLimitFromFormData } from "@/lib/upload-limits";
import { normalizeUserProfileFormData, normalizeUserProfileInput } from "@/lib/user-profile";

type CreateUserState = {
  error?: string;
  message?: string;
};

type UpdateUserIdentityState = CreateUserState;
type UpdateUserUploadLimitState = CreateUserState;

function cleanRole(value: FormDataEntryValue | null) {
  return value === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER;
}

function isUniqueEmailError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function isLastAdmin(id: string) {
  const [user, adminCount] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { role: true } }),
    prisma.user.count({ where: { role: UserRole.ADMIN } })
  ]);
  return user?.role === UserRole.ADMIN && adminCount <= 1;
}

export async function createUserAction(_state: CreateUserState | null, formData: FormData): Promise<CreateUserState> {
  try {
    validateCsrf(formData);
  } catch {
    return { error: "The form expired. Please refresh and try again." };
  }

  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin?next=/admin/users");

  const parsedProfile = normalizeUserProfileInput({
    email: formData.get("email"),
    name: formData.get("name")
  });
  const password = String(formData.get("password") ?? "");
  const role = cleanRole(formData.get("role"));

  if (parsedProfile.error) return { error: parsedProfile.error };
  if (!parsedProfile.data) return { error: "Enter a valid email address." };
  if (password && password.length < 12) return { error: "Temporary passwords must be at least 12 characters." };
  if (password.length > 4096) return { error: "Temporary passwords must be 4,096 characters or fewer." };

  const { email, name } = parsedProfile.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password || randomToken(48)),
      passwordResetEligible: Boolean(password),
      role
    }
  });

  revalidatePath("/admin/users");
  return { message: `Created ${email} as ${role === UserRole.ADMIN ? "an admin" : "a user"}.` };
}

export async function updateUserIdentityAction(
  _state: UpdateUserIdentityState | null,
  formData: FormData
): Promise<UpdateUserIdentityState> {
  try {
    validateCsrf(formData);
  } catch {
    return { error: "The form expired. Please refresh and try again." };
  }

  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin?next=/admin/users");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Choose a user to update." };

  const parsed = normalizeUserProfileFormData(formData);
  if (parsed.error) return { error: parsed.error };
  if (!parsed.data) return { error: "Enter a valid email address." };
  const profile = parsed.data;

  const [target, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true } }),
    prisma.user.findFirst({
      where: {
        email: profile.email,
        NOT: { id }
      },
      select: { id: true }
    })
  ]);
  if (!target) return { error: "That user no longer exists." };
  if (existing) return { error: "A user with that email already exists." };

  const submittedRole = formData.get("role");
  const role = submittedRole === null ? null : cleanRole(submittedRole);
  if (role && id === admin.id && role !== target.role) {
    return { error: "You cannot change your own role." };
  }
  if (id === admin.id && profile.email !== target.email.trim().toLowerCase()) {
    return { error: "Change your own email from Profile so you can verify your identity." };
  }
  if (role === UserRole.USER && target.role === UserRole.ADMIN && (await isLastAdmin(id))) {
    return { error: "At least one admin user is required." };
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        ...profile,
        ...(role ? { role } : {})
      }
    });
  } catch (error) {
    if (isUniqueEmailError(error)) return { error: "A user with that email already exists." };
    throw error;
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin", "layout");
  return { message: "User updated." };
}

export async function updateUserRoleAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin?next=/admin/users");

  const id = String(formData.get("id") ?? "");
  const role = cleanRole(formData.get("role"));

  if (id === admin.id) throw new Error("You cannot change your own role.");
  if (role === UserRole.USER && (await isLastAdmin(id))) {
    throw new Error("At least one admin user is required.");
  }

  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/admin/users");
}

export async function updateUserUploadLimitAction(
  _state: UpdateUserUploadLimitState | null,
  formData: FormData
): Promise<UpdateUserUploadLimitState> {
  try {
    validateCsrf(formData);
  } catch {
    return { error: "The form expired. Please refresh and try again." };
  }
  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin?next=/admin/users");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Choose a user to update." };

  let limit: ReturnType<typeof userUploadLimitFromFormData>;
  try {
    limit = userUploadLimitFromFormData(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Choose a valid upload limit." };
  }

  const result = await prisma.user.updateMany({ where: { id }, data: limit });
  if (result.count === 0) return { error: "That user no longer exists." };
  revalidatePath("/admin/users");
  revalidatePath("/admin/tools");
  return { message: "Upload limit updated." };
}

export async function deleteUserAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) redirect("/admin?next=/admin/users");

  const id = String(formData.get("id") ?? "");
  if (id === admin.id) throw new Error("You cannot delete your own account.");
  if (await isLastAdmin(id)) throw new Error("At least one admin user is required.");

  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
}
