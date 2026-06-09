"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

type CreateUserState = {
  error?: string;
  message?: string;
};

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanName(value: FormDataEntryValue | null) {
  return String(value ?? "").trim() || null;
}

export async function createUserAction(_state: CreateUserState | null, formData: FormData): Promise<CreateUserState> {
  try {
    validateCsrf(formData);
  } catch {
    return { error: "The form expired. Please refresh and try again." };
  }

  const admin = await requireAdmin();
  if (!admin) redirect("/login?next=/admin/users");

  const email = cleanEmail(formData.get("email"));
  const name = cleanName(formData.get("name"));
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };
  if (password.length < 12) return { error: "Temporary passwords must be at least 12 characters." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password)
    }
  });

  revalidatePath("/admin/users");
  return { message: `Created ${email}.` };
}

export async function deleteUserAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) redirect("/login?next=/admin/users");

  const id = String(formData.get("id") ?? "");
  if (id === admin.id) throw new Error("You cannot delete your own account.");

  const userCount = await prisma.user.count();
  if (userCount <= 1) throw new Error("At least one admin user is required.");

  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
}
