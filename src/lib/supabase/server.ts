import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/lib/env";
import { createClinicalFetch } from "@/lib/server/clinical-fetch";
import { clinicalConfigFromEnv, createClinicalCodec } from "@/lib/server/clinical-crypto.mjs";

export async function createServerSupabaseClient(options: { clinicalData?: boolean } = {}) {
  const config = getSupabasePublicEnv();

  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    ...(options.clinicalData ? {
      global: { fetch: createClinicalFetch(config.url, createClinicalCodec(clinicalConfigFromEnv())) },
    } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies during render.
        }
      },
    },
  });
}

let adminClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createAdminSupabaseClient() {
  const config = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!config || !serviceRoleKey) {
    return null;
  }

  if (!adminClient) {
    adminClient = createSupabaseClient(config.url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
