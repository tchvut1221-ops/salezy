import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const admin = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await admin
  .from("buckets")
  .select("*")
  .eq("id", "recordings")
  .maybeSingle();

// storage.buckets isn't in the public schema — query via the storage admin API instead.
const { data: bucket, error: bucketError } = await admin.storage.getBucket("recordings");

console.log(JSON.stringify({ viaTable: { data, error: error?.message }, viaStorageApi: { bucket, error: bucketError?.message } }, null, 2));
