import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/auth";

export default async function AdminIndexPage() {
  await getAdminContext();
  redirect("/admin/revenue");
}
