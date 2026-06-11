import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin Login"
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginCompatibilityPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value) {
      query.set(key, value);
    }
  }
  const queryText = query.toString();
  redirect(queryText ? `/admin?${queryText}` : "/admin");
}
