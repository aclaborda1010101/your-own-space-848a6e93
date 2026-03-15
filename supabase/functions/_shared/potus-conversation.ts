import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PotusConversationContext {
  conversationKey: string;
  surfaces: string[];
  telegramLinked: boolean;
  telegramUserId?: string | null;
}

export async function resolvePotusConversationContext(
  supabase: any,
  userId: string,
): Promise<PotusConversationContext> {
  const { data: telegramLink } = await supabase
    .from("platform_users")
    .select("platform_user_id")
    .eq("user_id", userId)
    .eq("platform", "telegram")
    .limit(1)
    .maybeSingle();

  const telegramUserId = (telegramLink as any)?.platform_user_id || null;

  return {
    conversationKey: telegramUserId
      ? `potus:telegram:${telegramUserId}`
      : `potus:user:${userId}`,
    surfaces: telegramUserId ? ["app", "telegram"] : ["app"],
    telegramLinked: Boolean(telegramUserId),
    telegramUserId,
  };
}

export function buildPotusMessageMetadata(input: {
  conversationKey: string;
  source: "app" | "telegram" | "system";
  transport?: string;
  platformUserId?: string | null;
  extra?: Record<string, unknown>;
}) {
  return {
    conversationKey: input.conversationKey,
    source: input.source,
    transport: input.transport || input.source,
    platformUserId: input.platformUserId || null,
    ...(input.extra || {}),
  };
}
