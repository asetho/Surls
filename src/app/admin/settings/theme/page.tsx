import { redirect } from "next/navigation";

export default function ThemeEditorPage() {
  redirect("/admin/settings?themeEditor=open");
}
