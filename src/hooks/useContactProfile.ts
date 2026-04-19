import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ContactLite {
  id: string;
  name: string;
  category?: string | null;
}

export interface ContactLink {
  id: string;
  source_contact_id: string;
  target_contact_id: string;
  mentioned_name: string;
  context: string | null;
  first_mention_date: string | null;
  status: string;
}

/**
 * Centralizes loading the personality_profile + contact links + sibling contacts
 * needed to render <ProfileByScope />.
 */
export function useContactProfile(contactId: string | undefined, userId: string | undefined) {
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [allContacts, setAllContacts] = useState<ContactLite[]>([]);
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!contactId || !userId) return;
    setLoading(true);
    try {
      const [{ data: contact }, { data: contacts }, { data: links }] = await Promise.all([
        supabase
          .from("people_contacts")
          .select("personality_profile")
          .eq("id", contactId)
          .maybeSingle(),
        supabase
          .from("people_contacts")
          .select("id,name,category")
          .eq("user_id", userId)
          .order("name"),
        (supabase as any)
          .from("contact_links")
          .select("*")
          .or(`source_contact_id.eq.${contactId},target_contact_id.eq.${contactId}`),
      ]);

      setProfile((contact?.personality_profile as Record<string, any>) || null);
      setAllContacts((contacts as ContactLite[]) || []);
      setContactLinks((links as ContactLink[]) || []);
    } finally {
      setLoading(false);
    }
  }, [contactId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const linkContact = useCallback(
    async (sourceId: string, targetId: string, name: string, context: string) => {
      try {
        await (supabase as any).from("contact_links").insert({
          source_contact_id: sourceId,
          target_contact_id: targetId,
          mentioned_name: name,
          context,
          status: "linked",
          first_mention_date: new Date().toISOString(),
        });
        await load();
      } catch (e) {
        console.error("linkContact:", e);
      }
    },
    [load]
  );

  const ignoreContact = useCallback(
    async (sourceId: string, name: string) => {
      try {
        await (supabase as any).from("contact_links").insert({
          source_contact_id: sourceId,
          mentioned_name: name,
          status: "ignored",
        });
        await load();
      } catch (e) {
        console.error("ignoreContact:", e);
      }
    },
    [load]
  );

  return { profile, allContacts, contactLinks, loading, reload: load, linkContact, ignoreContact };
}
