import { isProviderUsageId, queryProviderUsage } from "@/lib/provider-usage";

/** Port of app/api/provider-usage/query (POST) — provider usage quotas.
 *  Request-security/Content-Type checks are HTTP concerns; the typed IPC
 *  channel is only reachable from the trusted renderer. */
export async function providerUsageQuery(providerId: unknown): Promise<unknown> {
  if (typeof providerId !== "string" || !isProviderUsageId(providerId)) {
    return { error: "Unsupported provider" };
  }
  try {
    return await queryProviderUsage(providerId);
  } catch {
    return {
      providerId,
      status: "query-failed",
      message: "The provider usage query failed.",
    };
  }
}
