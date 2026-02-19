import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserSettings } from "./useUserSettings";
import { parseVCardFile, type ParsedVCardContact } from "@/lib/vcard-parser";
import { extractTextFromFile, extractMessagesFromWhatsAppTxt } from "@/lib/whatsapp-file-extract";
import { detectBlockFormat, parseBlockFormatTxt } from "@/lib/whatsapp-block-parser";
import { toast } from "sonner";

export type OnboardingStep = 0 | 1 | 2 | 3 | 4; // 0=welcome, 1=contacts, 2=whatsapp, 3=email, 4=linking

export interface ContactImportResult {
  newCount: number;
  enrichedCount: number;
  duplicateCount: number;
  total: number;
}

export interface WhatsAppImportResult {
  chatCount: number;
  messageCount: number;
  linkedCount: number;
}

export interface LinkSuggestion {
  id: string;
  mentioned_name: string;
  mentioned_in_source: string;
  suggested_contact_id: string | null;
  suggested_contact_name: string | null;
  confidence: number;
  confidence_reasons: string[];
  status: string;
}

export function useOnboarding() {
  const { user } = useAuth();
  const { updateSettings } = useUserSettings();
  const [step, setStep] = useState<OnboardingStep>(0);
  const [loading, setLoading] = useState(false);

  // Step 1 state
  const [contactResult, setContactResult] = useState<ContactImportResult | null>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedVCardContact[]>([]);

  // Step 2 state
  const [whatsappResult, setWhatsappResult] = useState<WhatsAppImportResult | null>(null);

  // Step 3 state
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Step 4 state
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);

  // ── Step 1: Import VCF ──────────────────────────────────────────────────────

  const importVCF = useCallback(async (file: File) => {
    if (!user) return;
    setLoading(true);

    try {
      const text = await file.text();
      const contacts = parseVCardFile(text);
      setParsedContacts(contacts);

      if (contacts.length === 0) {
        toast.error("No se encontraron contactos en el archivo");
        setLoading(false);
        return;
      }

      // Fetch existing contacts for dedup
      const { data: existing } = await (supabase as any)
        .from("people_contacts")
        .select("id, name, phone_numbers, emails, company, role")
        .eq("user_id", user.id)
        .limit(5000);

      const existingMap = new Map<string, any>();
      const phoneMap = new Map<string, any>();
      const emailMap = new Map<string, any>();

      (existing || []).forEach((c: any) => {
        existingMap.set(c.id, c);
        const phones = c.phone_numbers || [];
        phones.forEach((p: string) => {
          const norm = p.replace(/[^\d+]/g, '');
          if (norm) phoneMap.set(norm, c);
        });
        const emails = c.emails || [];
        emails.forEach((e: string) => {
          if (e) emailMap.set(e.toLowerCase(), c);
        });
      });

      let newCount = 0;
      let enrichedCount = 0;
      let duplicateCount = 0;

      for (const vc of contacts) {
        // Check for duplicate by phone or email
        let matchedContact: any = null;

        for (const phone of vc.phones) {
          const norm = phone.replace(/[^\d+]/g, '');
          if (phoneMap.has(norm)) {
            matchedContact = phoneMap.get(norm);
            break;
          }
        }
        if (!matchedContact) {
          for (const email of vc.emails) {
            if (emailMap.has(email.toLowerCase())) {
              matchedContact = emailMap.get(email.toLowerCase());
              break;
            }
          }
        }

        if (matchedContact) {
          // Enrich existing contact
          const updates: any = {};
          let needsUpdate = false;

          // Add new phones
          const existingPhones = (matchedContact.phone_numbers || []).map((p: string) => p.replace(/[^\d+]/g, ''));
          const newPhones = vc.phones.filter(p => !existingPhones.includes(p.replace(/[^\d+]/g, '')));
          if (newPhones.length > 0) {
            updates.phone_numbers = [...(matchedContact.phone_numbers || []), ...newPhones];
            needsUpdate = true;
          }

          // Add new emails
          const existingEmails = (matchedContact.emails || []).map((e: string) => e.toLowerCase());
          const newEmails = vc.emails.filter(e => !existingEmails.includes(e.toLowerCase()));
          if (newEmails.length > 0) {
            updates.emails = [...(matchedContact.emails || []), ...newEmails];
            needsUpdate = true;
          }

          // Fill empty fields
          if (!matchedContact.company && vc.organization) {
            updates.company = vc.organization;
            needsUpdate = true;
          }
          if (!matchedContact.role && vc.title) {
            updates.role = vc.title;
            needsUpdate = true;
          }

          // Always save vcard_raw
          updates.vcard_raw = vc.raw;

          if (needsUpdate) {
            await (supabase as any)
              .from("people_contacts")
              .update(updates)
              .eq("id", matchedContact.id);
            enrichedCount++;
          } else {
            // Save vcard_raw even if nothing else changed
            await (supabase as any)
              .from("people_contacts")
              .update({ vcard_raw: vc.raw })
              .eq("id", matchedContact.id);
            duplicateCount++;
          }
        } else {
          // Create new contact
          const { data: newContact } = await (supabase as any)
            .from("people_contacts")
            .insert({
              user_id: user.id,
              name: vc.fullName,
              phone_numbers: vc.phones,
              emails: vc.emails,
              company: vc.organization || null,
              role: vc.title || null,
              notes: vc.notes || null,
              vcard_raw: vc.raw,
              source: "vcf_import",
            })
            .select("id")
            .single();

          if (newContact) {
            // Register phones and emails in maps for next iterations
            vc.phones.forEach(p => {
              const norm = p.replace(/[^\d+]/g, '');
              if (norm) phoneMap.set(norm, { ...newContact, phone_numbers: vc.phones, emails: vc.emails });
            });
            vc.emails.forEach(e => {
              emailMap.set(e.toLowerCase(), { ...newContact, phone_numbers: vc.phones, emails: vc.emails });
            });
          }
          newCount++;
        }
      }

      setContactResult({ newCount, enrichedCount, duplicateCount, total: contacts.length });
      toast.success(`${contacts.length} contactos procesados`);
    } catch (err) {
      console.error("Error importing VCF:", err);
      toast.error("Error al importar el archivo");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Step 2: Import WhatsApp ─────────────────────────────────────────────────

  const importWhatsApp = useCallback(async (files: File[]) => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: profile } = await (supabase as any)
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const myIdentifiers = [
        profile?.display_name,
        user.email?.split("@")[0],
        "Yo",
      ].filter(Boolean) as string[];

      let totalChats = 0;
      let totalMessages = 0;
      let linkedCount = 0;

      // Fetch existing contacts for matching
      const { data: existingContacts } = await (supabase as any)
        .from("people_contacts")
        .select("id, name, phone_numbers")
        .eq("user_id", user.id)
        .limit(5000);

      const contactsByName = new Map<string, any>();
      (existingContacts || []).forEach((c: any) => {
        contactsByName.set(c.name.toLowerCase().trim(), c);
      });

      // Check existing chat names to avoid duplicates
      const { data: existingChats } = await (supabase as any)
        .from("contact_messages")
        .select("chat_name")
        .eq("user_id", user.id);

      const existingChatNames = new Set(
        (existingChats || []).map((c: any) => c.chat_name?.toLowerCase().trim())
      );

      for (const file of files) {
        const text = await extractTextFromFile(file);
        const chatName = file.name.replace(/\.txt$/i, '').replace(/Chat de WhatsApp con /i, '').trim();

        if (existingChatNames.has(chatName.toLowerCase().trim())) continue;

        let messages;
        if (detectBlockFormat(text)) {
          messages = parseBlockFormatTxt(text, chatName, myIdentifiers);
        } else {
          messages = extractMessagesFromWhatsAppTxt(text, chatName, myIdentifiers);
        }

        if (messages.length === 0) continue;

        // Try to match with existing contact
        const matchedContact = contactsByName.get(chatName.toLowerCase().trim());
        const contactId = matchedContact?.id || null;

        if (contactId) linkedCount++;

        // Save messages in batches
        const BATCH = 500;
        for (let i = 0; i < messages.length; i += BATCH) {
          const batch = messages.slice(i, i + BATCH).map(m => ({
            user_id: user.id,
            contact_id: contactId,
            chat_name: chatName,
            sender: m.sender,
            content: m.content,
            message_date: m.messageDate,
            direction: m.direction,
            source: "whatsapp",
          }));

          await (supabase as any).from("contact_messages").insert(batch);
        }

        // Update contact wa_message_count
        if (contactId) {
          const incomingCount = messages.filter(m => m.direction === 'incoming').length;
          await (supabase as any)
            .from("people_contacts")
            .update({ wa_message_count: incomingCount })
            .eq("id", contactId);
        }

        // If not matched, create alias suggestion for step 4
        if (!contactId && chatName) {
          await (supabase as any).from("contact_link_suggestions").insert({
            user_id: user.id,
            mentioned_name: chatName,
            mentioned_in_source: "whatsapp",
            mentioned_in_id: file.name,
            confidence: 0.5,
            status: "pending",
          });
        }

        totalChats++;
        totalMessages += messages.length;
      }

      setWhatsappResult({ chatCount: totalChats, messageCount: totalMessages, linkedCount });
      toast.success(`${totalChats} chats importados con ${totalMessages} mensajes`);
    } catch (err) {
      console.error("Error importing WhatsApp:", err);
      toast.error("Error al importar WhatsApp");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Step 3: Email ───────────────────────────────────────────────────────────

  const fetchEmailAccounts = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("email_accounts")
      .select("*")
      .eq("user_id", user.id);
    setEmailAccounts(data || []);
  }, [user]);

  const syncEmails = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-sync", {
        body: { action: "reprocess", userId: user.id },
      });
      if (error) throw error;
      toast.success("Sincronización de emails completada");
      await fetchEmailAccounts();
    } catch (err) {
      console.error("Error syncing emails:", err);
      toast.error("Error al sincronizar emails");
    } finally {
      setSyncing(false);
    }
  }, [user, fetchEmailAccounts]);

  // ── Step 4: Linking ─────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get pending suggestions
      const { data: pendingSugg } = await (supabase as any)
        .from("contact_link_suggestions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending");

      // Get all contacts for matching
      const { data: allContacts } = await (supabase as any)
        .from("people_contacts")
        .select("id, name")
        .eq("user_id", user.id)
        .limit(5000);

      const contactsList = allContacts || [];

      // Try to find matches for suggestions without suggested_contact
      const enriched: LinkSuggestion[] = (pendingSugg || []).map((s: any) => {
        let suggestedId = s.suggested_contact;
        let suggestedName = null;
        const reasons: string[] = [];

        if (!suggestedId) {
          // Try name matching
          const mentionedLower = s.mentioned_name.toLowerCase().trim();
          for (const c of contactsList) {
            const contactLower = c.name.toLowerCase().trim();
            if (contactLower === mentionedLower) {
              suggestedId = c.id;
              suggestedName = c.name;
              reasons.push("nombre_exacto");
              break;
            }
            if (contactLower.includes(mentionedLower) || mentionedLower.includes(contactLower)) {
              suggestedId = c.id;
              suggestedName = c.name;
              reasons.push("nombre_parcial");
              break;
            }
          }
        } else {
          suggestedName = contactsList.find((c: any) => c.id === suggestedId)?.name || null;
        }

        return {
          id: s.id,
          mentioned_name: s.mentioned_name,
          mentioned_in_source: s.mentioned_in_source,
          suggested_contact_id: suggestedId,
          suggested_contact_name: suggestedName,
          confidence: s.confidence,
          confidence_reasons: reasons,
          status: s.status,
        };
      });

      setSuggestions(enriched);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const acceptSuggestion = useCallback(async (suggestionId: string, contactId: string, mentionedName: string) => {
    if (!user) return;

    // Create alias
    await (supabase as any).from("contact_aliases").insert({
      user_id: user.id,
      contact_id: contactId,
      alias: mentionedName,
      source: "wizard",
      confidence: 1.0,
    });

    // Update suggestion status
    await (supabase as any)
      .from("contact_link_suggestions")
      .update({ status: "accepted", resolved_at: new Date().toISOString() })
      .eq("id", suggestionId);

    // Link messages with this chat_name to the contact
    await (supabase as any)
      .from("contact_messages")
      .update({ contact_id: contactId })
      .eq("user_id", user.id)
      .eq("chat_name", mentionedName)
      .is("contact_id", null);

    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    toast.success(`"${mentionedName}" vinculado correctamente`);
  }, [user]);

  const rejectSuggestion = useCallback(async (suggestionId: string) => {
    await (supabase as any)
      .from("contact_link_suggestions")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", suggestionId);

    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  const deferSuggestion = useCallback(async (suggestionId: string) => {
    await (supabase as any)
      .from("contact_link_suggestions")
      .update({ status: "deferred" })
      .eq("id", suggestionId);

    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  // ── Complete onboarding ─────────────────────────────────────────────────────

  const completeOnboarding = useCallback(async () => {
    try {
      await updateSettings({ onboarding_completed: true } as any);
      toast.success("¡Configuración completada!");
    } catch (err) {
      console.error("Error completing onboarding:", err);
    }
  }, [updateSettings]);

  return {
    step,
    setStep,
    loading,

    // Step 1
    importVCF,
    contactResult,
    parsedContacts,

    // Step 2
    importWhatsApp,
    whatsappResult,

    // Step 3
    emailAccounts,
    fetchEmailAccounts,
    syncEmails,
    syncing,

    // Step 4
    suggestions,
    fetchSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    deferSuggestion,

    // Finish
    completeOnboarding,
  };
}
