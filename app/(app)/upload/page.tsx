import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "@/components/salezy/upload-form";

export const metadata: Metadata = { title: "העלאת שיחה" };

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase
    .from("analyses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .limit(1);

  return <UploadForm hasNoAnalyses={!count} />;
}
