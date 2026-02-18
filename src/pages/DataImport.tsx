import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  MessageSquare,
  Mic,
  FileText,
  Upload,
  Loader2,
  UserPlus,
  Check,
  X,
  Edit2,
  Plus,
  User,
  UserCheck,
  BookUser,
  ChevronsUpDown,
  FileUp,
  Search,
  SkipForward,
  Link,
  Users,
} from "lucide-react";
import { extractTextFromFile, parseBackupCSVByChat, extractMessagesFromBackupCSV, type ParsedBackupChat, type ParsedMessage } from "@/lib/whatsapp-file-extract";
import { Checkbox } from "@/components/ui/checkbox";

interface DetectedContact {
  name: string;
  role?: string;
  confirmed: boolean;
  editing: boolean;
}

interface ImportResult {
  type: "whatsapp" | "audio" | "plaud";
  fileName: string;
  summary?: string;
  contacts: DetectedContact[];
  transcription?: string;
  processing: boolean;
  processed: boolean;
  linkedContactId?: string;
  linkedContactName?: string;
}

interface ExistingContact {
  id: string;
  name: string;
}

interface ParsedChat {
  file: File;
  detectedSpeaker: string;
  messageCount: number;
  myMessageCount: number;
  matchedContactId: string | null;
  matchedContactName: string;
  action: 'link' | 'create' | 'skip';
  comboOpen?: boolean;
}

// ── CSV Parsing helpers ──────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-\(\)\.]/g, '').replace(/^(\+34|0034)/, '');
}

interface ParsedContact {
  display_name: string;
  phone_numbers: string[];
  email: string | null;
  company: string | null;
  birthday: string | null;
  raw_data: Record<string, string>;
}

function parseContactsCSV(text: string): ParsedContact[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const hIdx = (names: string[]) => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.toLowerCase().includes(n.toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iNombre = hIdx(['Nombre', 'First Name', 'Given Name']);
  const iSegundo = hIdx(['Segundo nombre', 'Middle Name']);
  const iApellidos = hIdx(['Apellidos', 'Last Name', 'Family Name']);
  const iMovil = hIdx(['Teléfono móvil', 'Telefono movil', 'Mobile Phone', 'Phone']);
  const iCasa = hIdx(['Teléfono de la casa', 'Home Phone']);
  const iTrabajo = hIdx(['Teléfono del trabajo', 'Work Phone', 'Business Phone']);
  const iOtro = hIdx(['Otro teléfono', 'Other Phone']);
  const iEmailCasa = hIdx(['Email de la casa', 'Home Email', 'E-mail Address']);
  const iEmailTrabajo = hIdx(['Email del trabajo', 'Work Email', 'E-mail 2 Address']);
  const iEmpresa = hIdx(['Empresa', 'Company', 'Organization']);
  const iCumple = hIdx(['Cumpleaños', 'Birthday']);

  const contacts: ParsedContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const parts = [
      iNombre >= 0 ? cols[iNombre] : '',
      iSegundo >= 0 ? cols[iSegundo] : '',
      iApellidos >= 0 ? cols[iApellidos] : '',
    ].filter(Boolean);
    const display_name = parts.join(' ').trim();
    if (!display_name) continue;

    const phones: string[] = [];
    for (const idx of [iMovil, iCasa, iTrabajo, iOtro]) {
      if (idx >= 0 && cols[idx]) {
        const normalized = normalizePhone(cols[idx]);
        if (normalized.length >= 6) phones.push(normalized);
      }
    }

    const email = (iEmailCasa >= 0 ? cols[iEmailCasa] : '') || (iEmailTrabajo >= 0 ? cols[iEmailTrabajo] : '') || null;
    const company = iEmpresa >= 0 ? cols[iEmpresa] || null : null;
    const birthday = iCumple >= 0 ? cols[iCumple] || null : null;

    const raw_data: Record<string, string> = {};
    headers.forEach((h, idx) => { if (cols[idx]) raw_data[h] = cols[idx]; });

    contacts.push({ display_name, phone_numbers: phones, email: email || null, company, birthday, raw_data });
  }

  return contacts;
}

// ── WhatsApp file parser ─────────────────────────────────────────────────────

function parseWhatsAppSpeakers(text: string, myIdentifiers: string[]): {
  speakers: Map<string, number>;
  myMessageCount: number;
} {
  const speakers = new Map<string, number>();
  let myMessageCount = 0;
  const lines = text.split("\n");

  for (const line of lines) {
    const match = line.match(/(?:\[.*?\]|^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4},?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|a\.\s?m\.|p\.\s?m\.)?)\s*[-–]?\s*([^:]+?):\s/i);
    if (match) {
      const name = match[1].trim();
      if (name && !name.match(/^\+?\d[\d\s]+$/)) {
        if (myIdentifiers.length > 0 && myIdentifiers.includes(name.toLowerCase())) {
          myMessageCount++;
        } else {
          speakers.set(name, (speakers.get(name) || 0) + 1);
        }
      }
    }
  }

  return { speakers, myMessageCount };
}

function matchContactByName(name: string, contacts: ExistingContact[]): ExistingContact | null {
  const lower = name.toLowerCase().trim().replace(/\s+/g, ' ');
  // Exact match (normalized)
  const exact = contacts.find(c => c.name.toLowerCase().trim().replace(/\s+/g, ' ') === lower);
  if (exact) return exact;
  // Partial match (name contained in contact or vice versa)
  const partial = contacts.find(c => {
    const cLower = c.name.toLowerCase().trim().replace(/\s+/g, ' ');
    return cLower.includes(lower) || lower.includes(cLower);
  });
  return partial || null;
}

/** Find or create a contact, preventing duplicates */
async function findOrCreateContact(
  userId: string,
  name: string,
  existingContacts: ExistingContact[],
  context: string,
  brain: string = 'personal',
  metadata?: Record<string, unknown>
): Promise<{ id: string; name: string; isNew: boolean }> {
  const match = matchContactByName(name, existingContacts);
  if (match) return { id: match.id, name: match.name, isNew: false };

  const insertData: any = {
    user_id: userId,
    name: name.trim(),
    context,
    brain,
  };
  if (metadata) insertData.metadata = metadata;

  const { data: newContact, error } = await (supabase as any)
    .from("people_contacts")
    .insert(insertData)
    .select("id, name")
    .single();

  if (error) throw error;
  return { id: newContact.id, name: newContact.name, isNew: true };
}

// ── Main Component ───────────────────────────────────────────────────────────

const DataImport = () => {
  const { user } = useAuth();
  const { profile, updateProfile } = useUserProfile();
  const [results, setResults] = useState<ImportResult[]>([]);

  // ---- Existing contacts ----
  const [existingContacts, setExistingContacts] = useState<ExistingContact[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchContacts = async () => {
      const { data } = await (supabase as any)
        .from("people_contacts")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");
      if (data) setExistingContacts(data);
    };
    fetchContacts();
  }, [user]);

  // ---- CSV Contact Import ----
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvParsed, setCsvParsed] = useState<ParsedContact[] | null>(null);
  const [csvImported, setCsvImported] = useState(false);
  const [existingPhoneContactCount, setExistingPhoneContactCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from('phone_contacts').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }: any) => setExistingPhoneContactCount(count || 0));
  }, [user]);

  const handleCsvPreview = async () => {
    if (!csvFile) return;
    try {
      const text = await csvFile.text();
      const parsed = parseContactsCSV(text);
      setCsvParsed(parsed);
      if (parsed.length === 0) toast.error("No se detectaron contactos en el CSV");
    } catch {
      toast.error("Error al leer el CSV");
    }
  };

  const handleCsvImport = async (mode: 'add' | 'replace') => {
    if (!csvParsed || !user) return;
    setCsvProcessing(true);
    try {
      if (mode === 'replace') {
        await (supabase as any).from('phone_contacts').delete().eq('user_id', user.id);
      }

      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < csvParsed.length; i += batchSize) {
        const batch = csvParsed.slice(i, i + batchSize).map(c => ({
          user_id: user.id,
          display_name: c.display_name,
          phone_numbers: c.phone_numbers,
          email: c.email,
          company: c.company,
          birthday: c.birthday,
          raw_data: c.raw_data,
        }));
        const { error } = await (supabase as any).from('phone_contacts').insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }

      setCsvImported(true);
      setExistingPhoneContactCount(mode === 'replace' ? inserted : existingPhoneContactCount + inserted);
      toast.success(`${inserted} contactos importados a tu agenda oculta`);
    } catch (err) {
      console.error(err);
      toast.error("Error al importar contactos");
    } finally {
      setCsvProcessing(false);
    }
  };

  // ---- WhatsApp Import (Individual) ----
  const [waFile, setWaFile] = useState<File | null>(null);
  const [waProcessing, setWaProcessing] = useState(false);
  const [waContactMode, setWaContactMode] = useState<"existing" | "new">("existing");
  const [waSelectedContact, setWaSelectedContact] = useState<string>("");
  const [waNewContactName, setWaNewContactName] = useState("");
  const [contactSearchOpen, setContactSearchOpen] = useState(false);

  // ---- WhatsApp Bulk Import ----
  const [waImportMode, setWaImportMode] = useState<'bulk' | 'individual' | 'backup'>('bulk');
  const [waBulkFiles, setWaBulkFiles] = useState<File[]>([]);
  const [waParsedChats, setWaParsedChats] = useState<ParsedChat[]>([]);
  const [waBulkStep, setWaBulkStep] = useState<'select' | 'review' | 'importing' | 'done'>('select');
  const [waBulkAnalyzing, setWaBulkAnalyzing] = useState(false);
  const [waBulkImporting, setWaBulkImporting] = useState(false);
  const [waBulkResults, setWaBulkResults] = useState<{ imported: number; newContacts: number } | null>(null);

  // ---- Backup CSV Import (full backup with groups) ----
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupCsvText, setBackupCsvText] = useState<string>('');
  const [backupChats, setBackupChats] = useState<(ParsedBackupChat & { selected: boolean })[]>([]);
  const [backupStep, setBackupStep] = useState<'select' | 'review' | 'importing' | 'done'>('select');
  const [backupAnalyzing, setBackupAnalyzing] = useState(false);
  const [backupImporting, setBackupImporting] = useState(false);
  const [backupResults, setBackupResults] = useState<{ imported: number; newContacts: number; groupsProcessed: number } | null>(null);

  const getMyIdentifiers = useCallback(() => {
    const myIds = profile?.my_identifiers && typeof profile.my_identifiers === 'object' && !Array.isArray(profile.my_identifiers)
      ? profile.my_identifiers as Record<string, unknown>
      : {};
    const myWaNames: string[] = Array.isArray(myIds.whatsapp_names) ? (myIds.whatsapp_names as string[]) : [];
    const myWaNumbers: string[] = Array.isArray(myIds.whatsapp_numbers) ? (myIds.whatsapp_numbers as string[]) : [];
    return ['yo', ...myWaNames, ...myWaNumbers].map(n => n.toLowerCase().trim());
  }, [profile]);

  const handleBulkAnalyze = async () => {
    if (waBulkFiles.length === 0) return;
    setWaBulkAnalyzing(true);

    try {
      const myIdentifiers = getMyIdentifiers();
      const parsed: ParsedChat[] = [];

      for (const file of waBulkFiles) {
        const text = await extractTextFromFile(file);
        const { speakers, myMessageCount } = parseWhatsAppSpeakers(text, myIdentifiers);

        // Find dominant speaker (most messages, not me)
        let detectedSpeaker = "";
        let maxCount = 0;
        speakers.forEach((count, name) => {
          if (count > maxCount) {
            maxCount = count;
            detectedSpeaker = name;
          }
        });

        const totalOtherMessages = Array.from(speakers.values()).reduce((a, b) => a + b, 0);

        // Try to match against existing contacts
        const match = detectedSpeaker ? matchContactByName(detectedSpeaker, existingContacts) : null;

        parsed.push({
          file,
          detectedSpeaker: detectedSpeaker || "(sin detectar)",
          messageCount: totalOtherMessages,
          myMessageCount,
          matchedContactId: match?.id || null,
          matchedContactName: match?.name || "",
          action: match ? 'link' : 'create',
        });
      }

      setWaParsedChats(parsed);
      setWaBulkStep('review');
    } catch (err) {
      console.error(err);
      toast.error("Error al analizar los archivos");
    } finally {
      setWaBulkAnalyzing(false);
    }
  };

  const updateParsedChat = (idx: number, updates: Partial<ParsedChat>) => {
    setWaParsedChats(prev => prev.map((c, i) => i === idx ? { ...c, ...updates } : c));
  };

  const handleBulkImport = async () => {
    if (!user) return;
    setWaBulkImporting(true);
    setWaBulkStep('importing');

    let imported = 0;
    let newContacts = 0;

    try {
      const myIdentifiers = getMyIdentifiers();

      for (const chat of waParsedChats) {
        if (chat.action === 'skip') continue;

        let contactId = chat.matchedContactId;
        let contactName = chat.matchedContactName || chat.detectedSpeaker;

        // Create new contact if needed
        if (chat.action === 'create' || !contactId) {
          const result = await findOrCreateContact(
            user.id,
            chat.detectedSpeaker,
            existingContacts,
            "Importado desde WhatsApp (masivo)"
          );
          contactId = result.id;
          contactName = result.name;
          if (result.isNew) {
            newContacts++;
            setExistingContacts(prev => [...prev, { id: result.id, name: result.name }]);
          }
        }

        // Update wa_message_count
        if (contactId && chat.messageCount > 0) {
          await (supabase as any)
            .from("people_contacts")
            .update({ wa_message_count: chat.messageCount })
            .eq("id", contactId);
        }

        // Add to results for contact review
        const text = await extractTextFromFile(chat.file);
        const { speakers } = parseWhatsAppSpeakers(text, myIdentifiers);
        const contacts: DetectedContact[] = Array.from(speakers.keys())
          .filter(name => name !== chat.detectedSpeaker)
          .map(name => ({ name, role: "Contacto WhatsApp", confirmed: false, editing: false }));

        const summaryParts = [];
        if (chat.myMessageCount > 0) summaryParts.push(`${chat.myMessageCount} tuyos`);
        if (chat.messageCount > 0) summaryParts.push(`${chat.messageCount} del contacto`);
        summaryParts.push(`vinculado a ${contactName}`);

        const result: ImportResult = {
          type: "whatsapp",
          fileName: chat.file.name,
          summary: summaryParts.join(" · "),
          contacts,
          processing: false,
          processed: true,
          linkedContactId: contactId!,
          linkedContactName: contactName,
        };

        setResults(prev => [result, ...prev]);
        imported++;
      }

      setWaBulkResults({ imported, newContacts });
      setWaBulkStep('done');
      setExistingContacts(prev => [...prev].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`${imported} chats importados, ${newContacts} contactos nuevos creados`);
    } catch (err) {
      console.error(err);
      toast.error("Error durante la importación masiva");
      setWaBulkStep('review');
    } finally {
      setWaBulkImporting(false);
    }
  };

  const resetBulkImport = () => {
    setWaBulkFiles([]);
    setWaParsedChats([]);
    setWaBulkStep('select');
    setWaBulkResults(null);
  };

  // ---- Backup CSV handlers ----
  // Helper to store messages in contact_messages table
  const storeContactMessages = async (userId: string, contactId: string, chatName: string, speakerFilter: string | null) => {
    if (!backupCsvText) return;
    const myIdentifiers = getMyIdentifiers();
    const allMessages = extractMessagesFromBackupCSV(backupCsvText, chatName, myIdentifiers);
    
    // Filter by speaker if specified (for groups, only store messages from this specific speaker)
    const filteredMessages = speakerFilter 
      ? allMessages.filter(m => m.sender === speakerFilter || m.sender === 'Yo')
      : allMessages;

    // Batch insert in chunks of 500
    const batchSize = 500;
    for (let i = 0; i < filteredMessages.length; i += batchSize) {
      const batch = filteredMessages.slice(i, i + batchSize).map(m => ({
        user_id: userId,
        contact_id: contactId,
        source: 'whatsapp',
        sender: m.sender,
        content: m.content,
        message_date: m.messageDate ? new Date(m.messageDate).toISOString() : null,
        chat_name: m.chatName,
        direction: m.direction,
      }));

      await (supabase as any).from("contact_messages").insert(batch);
    }
  };

  const handleBackupAnalyze = async () => {
    if (!backupFile) return;
    setBackupAnalyzing(true);
    try {
      const text = await backupFile.text();
      setBackupCsvText(text);
      const myIdentifiers = getMyIdentifiers();
      const chats = parseBackupCSVByChat(text, myIdentifiers);

      if (chats.length === 0) {
        toast.error("No se detectó formato de backup CSV de WhatsApp");
        return;
      }

      setBackupChats(chats.map(c => ({ ...c, selected: true })));
      setBackupStep('review');
      toast.success(`${chats.length} conversaciones detectadas (${chats.filter(c => c.isGroup).length} grupos)`);
    } catch (err) {
      console.error(err);
      toast.error("Error al analizar el backup");
    } finally {
      setBackupAnalyzing(false);
    }
  };

  const handleBackupImport = async () => {
    if (!user) return;
    setBackupImporting(true);
    setBackupStep('importing');

    let imported = 0;
    let newContacts = 0;
    let groupsProcessed = 0;

    try {
      const selectedChats = backupChats.filter(c => c.selected);

      for (const chat of selectedChats) {
        if (chat.isGroup) {
          groupsProcessed++;
          // For groups: create/update ALL speakers
          for (const [speakerName, msgCount] of chat.speakers.entries()) {
            const match = matchContactByName(speakerName, existingContacts);
            let contactId = match?.id;

            if (!contactId) {
              const result = await findOrCreateContact(
                user.id,
                speakerName,
                existingContacts,
                `Importado desde grupo WhatsApp: ${chat.chatName}`,
                "personal",
                { groups: [chat.chatName] }
              );
              contactId = result.id;
              if (result.isNew) {
                newContacts++;
                setExistingContacts(prev => [...prev, { id: result.id, name: result.name }]);
              }
            } else {
              // Update existing: add group to metadata.groups and sum wa_message_count
              const { data: existing } = await (supabase as any)
                .from("people_contacts")
                .select("wa_message_count, metadata")
                .eq("id", contactId)
                .single();

              const currentMeta = existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {};
              const currentGroups: string[] = Array.isArray(currentMeta.groups) ? currentMeta.groups : [];
              if (!currentGroups.includes(chat.chatName)) {
                currentGroups.push(chat.chatName);
              }

              await (supabase as any)
                .from("people_contacts")
                .update({
                  wa_message_count: (existing?.wa_message_count || 0) + msgCount,
                  metadata: { ...currentMeta, groups: currentGroups },
                })
                .eq("id", contactId);
            }

            // Store messages for this speaker in this chat
            if (contactId) {
              await storeContactMessages(user.id, contactId, chat.chatName, speakerName);
            }
          }
        } else {
          // Individual chat: find dominant speaker
          let dominantSpeaker = '';
          let maxCount = 0;
          chat.speakers.forEach((count, name) => {
            if (count > maxCount) { maxCount = count; dominantSpeaker = name; }
          });

          if (!dominantSpeaker) continue;

          const match = matchContactByName(dominantSpeaker, existingContacts);
          let contactId = match?.id;

          if (!contactId) {
            const result = await findOrCreateContact(
              user.id,
              dominantSpeaker,
              existingContacts,
              "Importado desde WhatsApp (backup CSV)"
            );
            contactId = result.id;
            if (result.isNew) {
              newContacts++;
              setExistingContacts(prev => [...prev, { id: result.id, name: result.name }]);
            }
          }

          // Sum wa_message_count
          const { data: existing } = await (supabase as any)
            .from("people_contacts")
            .select("wa_message_count")
            .eq("id", contactId)
            .single();

          await (supabase as any)
            .from("people_contacts")
            .update({ wa_message_count: (existing?.wa_message_count || 0) + maxCount })
            .eq("id", contactId);

          // Store messages for this individual chat
          if (contactId) {
            await storeContactMessages(user.id, contactId, chat.chatName, null);
          }
        }

        imported++;
      }

      setBackupResults({ imported, newContacts, groupsProcessed });
      setBackupStep('done');
      toast.success(`${imported} chats importados · ${newContacts} contactos nuevos · ${groupsProcessed} grupos procesados`);
    } catch (err) {
      console.error(err);
      toast.error("Error durante la importación del backup");
      setBackupStep('review');
    } finally {
      setBackupImporting(false);
    }
  };

  const resetBackupImport = () => {
    setBackupFile(null);
    setBackupCsvText('');
    setBackupChats([]);
    setBackupStep('select');
    setBackupResults(null);
  };

  const handleWhatsAppImport = async () => {
    if (!waFile || !user) return;

    const hasContact = waContactMode === "existing" ? !!waSelectedContact : !!waNewContactName.trim();
    if (!hasContact) {
      toast.error("Selecciona o crea un contacto para vincular el chat");
      return;
    }

    setWaProcessing(true);

    try {
      let linkedContactId = "";
      let linkedContactName = "";

      if (waContactMode === "existing") {
        linkedContactId = waSelectedContact;
        linkedContactName = existingContacts.find((c) => c.id === waSelectedContact)?.name || "";
      } else {
        const result = await findOrCreateContact(
          user.id,
          waNewContactName.trim(),
          existingContacts,
          "Importado desde WhatsApp"
        );
        linkedContactId = result.id;
        linkedContactName = result.name;
        if (result.isNew) {
          setExistingContacts((prev) => [...prev, { id: result.id, name: result.name }].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }

      const text = await extractTextFromFile(waFile);
      const myIdentifiers = getMyIdentifiers();
      const { speakers, myMessageCount } = parseWhatsAppSpeakers(text, myIdentifiers);
      const otherMessageCount = Array.from(speakers.values()).reduce((a, b) => a + b, 0);
      const totalMessageCount = myMessageCount + otherMessageCount;

      if (linkedContactId && totalMessageCount > 0) {
        await (supabase as any)
          .from("people_contacts")
          .update({ wa_message_count: totalMessageCount })
          .eq("id", linkedContactId);
      }

      // ── Store actual message content in contact_messages ──
      let storedCount = 0;
      if (linkedContactId) {
        const { extractMessagesFromWhatsAppTxt } = await import("@/lib/whatsapp-file-extract");
        const parsedMessages = extractMessagesFromWhatsAppTxt(text, linkedContactName, myIdentifiers);
        storedCount = parsedMessages.length;

        // Batch insert in chunks of 500
        const batchSize = 500;
        for (let i = 0; i < parsedMessages.length; i += batchSize) {
          const batch = parsedMessages.slice(i, i + batchSize).map(m => ({
            user_id: user.id,
            contact_id: linkedContactId,
            source: 'whatsapp',
            sender: m.sender,
            content: m.content,
            message_date: m.messageDate || null,
            chat_name: m.chatName,
            direction: m.direction,
          }));
          await (supabase as any).from("contact_messages").insert(batch);
        }
      }

      const contacts: DetectedContact[] = Array.from(speakers.keys()).map((name) => ({
        name,
        role: "Contacto WhatsApp",
        confirmed: false,
        editing: false,
      }));

      const summaryParts = [];
      if (myMessageCount > 0) summaryParts.push(`${myMessageCount} mensajes tuyos`);
      if (otherMessageCount > 0) summaryParts.push(`${otherMessageCount} del contacto`);
      summaryParts.push(`${contacts.length} participantes`);
      if (storedCount > 0) summaryParts.push(`${storedCount} mensajes almacenados`);
      summaryParts.push(`vinculado a ${linkedContactName}`);

      const result: ImportResult = {
        type: "whatsapp",
        fileName: waFile.name,
        summary: summaryParts.join(" · "),
        contacts,
        processing: false,
        processed: true,
        linkedContactId,
        linkedContactName,
      };

      setResults((prev) => [result, ...prev]);
      setWaFile(null);
      setWaNewContactName("");
      setWaSelectedContact("");
      toast.success(`Chat importado: ${storedCount} mensajes almacenados y vinculado a "${linkedContactName}"`);
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar el archivo de WhatsApp");
    } finally {
      setWaProcessing(false);
    }
  };

  // ---- Audio Import ----
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioProcessing, setAudioProcessing] = useState(false);

  const handleAudioImport = async () => {
    if (!audioFile || !user) return;
    setAudioProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", audioFile);
      formData.append("language", "es");

      const { data, error } = await supabase.functions.invoke("speech-to-text", {
        body: formData,
      });

      if (error) throw error;

      const transcription = data?.text || "";
      const speakerMatches = transcription.match(/(?:Speaker|Hablante|Persona)\s*\w+/gi) || [];
      const uniqueSpeakers = [...new Set(speakerMatches)];

      const contacts: DetectedContact[] = uniqueSpeakers.map((name: string) => ({
        name,
        role: "Detectado en audio",
        confirmed: false,
        editing: false,
      }));

      const result: ImportResult = {
        type: "audio",
        fileName: audioFile.name,
        summary: `Transcripción completada (${transcription.length} caracteres)`,
        contacts,
        transcription,
        processing: false,
        processed: true,
      };

      setResults((prev) => [result, ...prev]);
      setAudioFile(null);
      toast.success("Audio transcrito correctamente");
    } catch (err) {
      console.error(err);
      toast.error("Error al transcribir el audio");
    } finally {
      setAudioProcessing(false);
    }
  };

  // ---- Plaud Import ----
  const [plaudFile, setPlaudFile] = useState<File | null>(null);
  const [plaudProcessing, setPlaudProcessing] = useState(false);

  const handlePlaudImport = async () => {
    if (!plaudFile || !user) return;
    setPlaudProcessing(true);

    try {
      const text = await plaudFile.text();
      const speakerSet = new Set<string>();
      const lines = text.split("\n");
      for (const line of lines) {
        const match = line.match(/^(Speaker\s*\w+|[\w\s]+?)(?:\s*\(\d{2}:\d{2}\))?\s*:/i);
        if (match) {
          speakerSet.add(match[1].trim());
        }
      }

      const contacts: DetectedContact[] = Array.from(speakerSet).map((name) => ({
        name,
        role: "Detectado en Plaud",
        confirmed: false,
        editing: false,
      }));

      const result: ImportResult = {
        type: "plaud",
        fileName: plaudFile.name,
        summary: `Transcripción Plaud procesada, ${contacts.length} hablantes detectados`,
        contacts,
        transcription: text,
        processing: false,
        processed: true,
      };

      setResults((prev) => [result, ...prev]);
      setPlaudFile(null);
      toast.success("Transcripción Plaud importada");
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar el archivo de Plaud");
    } finally {
      setPlaudProcessing(false);
    }
  };

  // ---- Contact Review ----
  const updateContactName = (resultIdx: number, contactIdx: number, newName: string) => {
    setResults((prev) =>
      prev.map((r, ri) =>
        ri === resultIdx
          ? {
              ...r,
              contacts: r.contacts.map((c, ci) =>
                ci === contactIdx ? { ...c, name: newName } : c
              ),
            }
          : r
      )
    );
  };

  const toggleContactEdit = (resultIdx: number, contactIdx: number) => {
    setResults((prev) =>
      prev.map((r, ri) =>
        ri === resultIdx
          ? {
              ...r,
              contacts: r.contacts.map((c, ci) =>
                ci === contactIdx ? { ...c, editing: !c.editing } : c
              ),
            }
          : r
      )
    );
  };

  const confirmContact = async (resultIdx: number, contactIdx: number) => {
    if (!user) return;
    const contact = results[resultIdx]?.contacts[contactIdx];
    if (!contact) return;

    try {
      const { error } = await (supabase as any)
        .from("people_contacts")
        .insert({
          user_id: user.id,
          name: contact.name,
          context: contact.role || "Importado desde datos",
          brain: "personal",
        });

      if (error) throw error;

      setResults((prev) =>
        prev.map((r, ri) =>
          ri === resultIdx
            ? {
                ...r,
                contacts: r.contacts.map((c, ci) =>
                  ci === contactIdx ? { ...c, confirmed: true } : c
                ),
              }
            : r
        )
      );

      toast.success(`Contacto "${contact.name}" creado`);
    } catch (err) {
      console.error(err);
      toast.error("Error al crear el contacto");
    }
  };

  const removeContact = (resultIdx: number, contactIdx: number) => {
    setResults((prev) =>
      prev.map((r, ri) =>
        ri === resultIdx
          ? { ...r, contacts: r.contacts.filter((_, ci) => ci !== contactIdx) }
          : r
      )
    );
  };

  const confirmAllContacts = async (resultIdx: number) => {
    const result = results[resultIdx];
    if (!result) return;
    for (let i = 0; i < result.contacts.length; i++) {
      if (!result.contacts[i].confirmed) {
        await confirmContact(resultIdx, i);
      }
    }
  };

  const markAsMySelf = async (resultIdx: number, contactIdx: number) => {
    if (!profile) return;
    const contact = results[resultIdx]?.contacts[contactIdx];
    if (!contact) return;

    const myIds = profile.my_identifiers && typeof profile.my_identifiers === 'object' && !Array.isArray(profile.my_identifiers)
      ? profile.my_identifiers as Record<string, unknown>
      : {};
    const currentNames: string[] = Array.isArray(myIds.whatsapp_names) ? (myIds.whatsapp_names as string[]) : [];

    if (!currentNames.map(n => n.toLowerCase()).includes(contact.name.toLowerCase())) {
      await updateProfile({
        my_identifiers: {
          ...myIds,
          whatsapp_names: [...currentNames, contact.name],
        } as any,
      });
    }

    removeContact(resultIdx, contactIdx);
    toast.success(`"${contact.name}" marcado como tú. Se recordará en futuras importaciones.`);
  };

  const typeIcons = {
    whatsapp: <MessageSquare className="w-4 h-4" />,
    audio: <Mic className="w-4 h-4" />,
    plaud: <FileText className="w-4 h-4" />,
  };

  const typeLabels = {
    whatsapp: "WhatsApp",
    audio: "Audio",
    plaud: "Plaud",
  };

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Importar Datos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Importa conversaciones, grabaciones y contactos del teléfono
        </p>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <BookUser className="w-4 h-4" />
            <span className="hidden sm:inline">Contactos</span>
          </TabsTrigger>
          <TabsTrigger value="audio" className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            <span className="hidden sm:inline">Audio</span>
          </TabsTrigger>
          <TabsTrigger value="plaud" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Plaud</span>
          </TabsTrigger>
        </TabsList>

        {/* Contacts CSV Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookUser className="w-5 h-5 text-primary" />
                Importar Agenda del Teléfono
              </CardTitle>
              <CardDescription>
                Sube un CSV exportado desde iPhone o Google Contacts. Los contactos se guardan como agenda oculta y se usarán para cruzar con tus chats de WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {existingPhoneContactCount > 0 && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm">
                  <span className="font-medium text-primary">{existingPhoneContactCount}</span> contactos ya importados en tu agenda oculta.
                </div>
              )}

              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    setCsvFile(e.target.files?.[0] || null);
                    setCsvParsed(null);
                    setCsvImported(false);
                  }}
                  className="flex-1"
                />
                <Button onClick={handleCsvPreview} disabled={!csvFile || csvProcessing}>
                  Previsualizar
                </Button>
              </div>

              {csvParsed && !csvImported && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-border bg-muted/30">
                    <p className="text-sm font-medium text-foreground">
                      {csvParsed.length} contactos detectados
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Con teléfono: {csvParsed.filter(c => c.phone_numbers.length > 0).length} · 
                      Con email: {csvParsed.filter(c => c.email).length} · 
                      Con empresa: {csvParsed.filter(c => c.company).length}
                    </p>
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {csvParsed.slice(0, 20).map((c, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="font-medium text-foreground">{c.display_name}</span>
                          {c.phone_numbers[0] && <span>{c.phone_numbers[0]}</span>}
                          {c.company && <span>{c.company}</span>}
                        </div>
                      ))}
                      {csvParsed.length > 20 && (
                        <p className="text-xs text-muted-foreground italic">...y {csvParsed.length - 20} más</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {existingPhoneContactCount > 0 ? (
                      <>
                        <Button onClick={() => handleCsvImport('add')} disabled={csvProcessing}>
                          {csvProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                          Añadir a existentes
                        </Button>
                        <Button variant="outline" onClick={() => handleCsvImport('replace')} disabled={csvProcessing}>
                          Reemplazar todo
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => handleCsvImport('add')} disabled={csvProcessing}>
                        {csvProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        Importar {csvParsed.length} contactos
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {csvImported && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary font-medium">Contactos importados correctamente</span>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                iPhone: Contactos → Seleccionar todos → Compartir → CSV. Google: contacts.google.com → Exportar → CSV.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Importar Chats de WhatsApp
              </CardTitle>
              <CardDescription>
                Sube archivos de WhatsApp (.txt, .csv, .pdf, .zip)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={waImportMode === 'bulk' ? 'default' : 'outline'}
                  onClick={() => setWaImportMode('bulk')}
                >
                  <FileUp className="w-3.5 h-3.5 mr-1" />
                  Importación rápida
                </Button>
                <Button
                  size="sm"
                  variant={waImportMode === 'backup' ? 'default' : 'outline'}
                  onClick={() => setWaImportMode('backup')}
                >
                  <Users className="w-3.5 h-3.5 mr-1" />
                  Backup completo (CSV)
                </Button>
                <Button
                  size="sm"
                  variant={waImportMode === 'individual' ? 'default' : 'outline'}
                  onClick={() => setWaImportMode('individual')}
                >
                  <User className="w-3.5 h-3.5 mr-1" />
                  Manual (individual)
                </Button>
              </div>

              {waImportMode === 'bulk' ? (
                /* ── Bulk Import Flow ── */
                <div className="space-y-4">
                  {waBulkStep === 'select' && (
                    <>
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          accept=".txt,.csv,.pdf,.zip"
                          multiple
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) setWaBulkFiles(Array.from(files));
                          }}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleBulkAnalyze}
                          disabled={waBulkFiles.length === 0 || waBulkAnalyzing}
                        >
                          {waBulkAnalyzing ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Search className="w-4 h-4 mr-2" />
                          )}
                          Analizar {waBulkFiles.length > 0 ? `(${waBulkFiles.length})` : ''}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Selecciona múltiples archivos .txt. Se detectará automáticamente el contacto de cada chat.
                      </p>
                    </>
                  )}

                  {/* ... keep existing code (bulk review, importing, done steps) */}
                  {waBulkStep === 'review' && (
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm">
                        <span className="font-medium text-primary">{waParsedChats.length}</span> chats analizados.
                        {' '}<span className="font-medium text-primary">{waParsedChats.filter(c => c.matchedContactId).length}</span> vinculados automáticamente.
                        {' '}Revisa y confirma:
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Archivo</TableHead>
                              <TableHead>Contacto detectado</TableHead>
                              <TableHead className="text-center">Msgs</TableHead>
                              <TableHead>Vinculación</TableHead>
                              <TableHead className="text-center">Acción</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {waParsedChats.map((chat, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs font-mono max-w-[150px] truncate">
                                  {chat.file.name}
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm font-medium">{chat.detectedSpeaker}</span>
                                </TableCell>
                                <TableCell className="text-center text-xs text-muted-foreground">
                                  {chat.messageCount}
                                </TableCell>
                                <TableCell>
                                  {chat.matchedContactId ? (
                                    <Badge variant="secondary" className="gap-1">
                                      <Check className="w-3 h-3" />
                                      {chat.matchedContactName}
                                    </Badge>
                                  ) : chat.action === 'create' ? (
                                    <Badge variant="outline" className="gap-1 text-primary border-primary/30">
                                      <Plus className="w-3 h-3" />
                                      Nuevo
                                    </Badge>
                                  ) : chat.action === 'skip' ? (
                                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                                      <SkipForward className="w-3 h-3" />
                                      Ignorar
                                    </Badge>
                                  ) : null}
                                </TableCell>
                                <TableCell>
                                  {!chat.matchedContactId && (
                                    <div className="flex items-center gap-1">
                                      <Popover
                                        open={chat.comboOpen}
                                        onOpenChange={(open) => updateParsedChat(idx, { comboOpen: open })}
                                      >
                                        <PopoverTrigger asChild>
                                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                            <Link className="w-3 h-3 mr-1" />
                                            Vincular
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-0" align="end">
                                          <Command>
                                            <CommandInput placeholder="Buscar contacto..." />
                                            <CommandList>
                                              <CommandEmpty>No encontrado</CommandEmpty>
                                              <CommandGroup>
                                                {existingContacts.map((c) => (
                                                  <CommandItem
                                                    key={c.id}
                                                    value={c.name}
                                                    onSelect={() => {
                                                      updateParsedChat(idx, {
                                                        matchedContactId: c.id,
                                                        matchedContactName: c.name,
                                                        action: 'link',
                                                        comboOpen: false,
                                                      });
                                                    }}
                                                  >
                                                    {c.name}
                                                  </CommandItem>
                                                ))}
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        </PopoverContent>
                                      </Popover>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className={cn(
                                          "h-7 px-2 text-xs",
                                          chat.action === 'skip' && "text-muted-foreground"
                                        )}
                                        onClick={() =>
                                          updateParsedChat(idx, {
                                            action: chat.action === 'skip' ? 'create' : 'skip',
                                          })
                                        }
                                        title={chat.action === 'skip' ? 'No ignorar' : 'Ignorar este chat'}
                                      >
                                        {chat.action === 'skip' ? (
                                          <><Plus className="w-3 h-3 mr-1" />Crear</>
                                        ) : (
                                          <><SkipForward className="w-3 h-3 mr-1" />Ignorar</>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleBulkImport} disabled={waBulkImporting}>
                          {waBulkImporting ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Upload className="w-4 h-4 mr-2" />
                          )}
                          Importar {waParsedChats.filter(c => c.action !== 'skip').length} chats
                        </Button>
                        <Button variant="outline" onClick={resetBulkImport}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {waBulkStep === 'importing' && (
                    <div className="flex items-center gap-3 p-6 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Importando chats...</span>
                    </div>
                  )}

                  {waBulkStep === 'done' && waBulkResults && (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                        <div className="flex items-center gap-2 mb-1">
                          <Check className="w-5 h-5 text-primary" />
                          <span className="font-medium text-primary">Importación completada</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {waBulkResults.imported} chats importados · {waBulkResults.newContacts} contactos nuevos creados
                        </p>
                      </div>
                      <Button variant="outline" onClick={resetBulkImport}>
                        Importar más
                      </Button>
                    </div>
                  )}
                </div>
              ) : waImportMode === 'backup' ? (
                /* ── Backup CSV Import Flow ── */
                <div className="space-y-4">
                  {backupStep === 'select' && (
                    <>
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            setBackupFile(e.target.files?.[0] || null);
                            setBackupChats([]);
                          }}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleBackupAnalyze}
                          disabled={!backupFile || backupAnalyzing}
                        >
                          {backupAnalyzing ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Search className="w-4 h-4 mr-2" />
                          )}
                          Analizar backup
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sube el CSV completo de backup de WhatsApp (12 columnas). Se detectarán todos los chats y grupos automáticamente.
                      </p>
                    </>
                  )}

                  {backupStep === 'review' && (
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm">
                        <span className="font-medium text-primary">{backupChats.length}</span> conversaciones detectadas.
                        {' '}<span className="font-medium text-primary">{backupChats.filter(c => c.isGroup).length}</span> grupos,
                        {' '}<span className="font-medium text-primary">{backupChats.filter(c => !c.isGroup).length}</span> individuales.
                        {' '}Selecciona cuáles importar:
                      </div>

                      <div className="flex gap-2 mb-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBackupChats(prev => prev.map(c => ({ ...c, selected: true })))}
                        >
                          Seleccionar todos
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBackupChats(prev => prev.map(c => ({ ...c, selected: false })))}
                        >
                          Deseleccionar todos
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBackupChats(prev => prev.map(c => ({ ...c, selected: c.isGroup })))}
                        >
                          Solo grupos
                        </Button>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-border max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10"></TableHead>
                              <TableHead>Chat / Grupo</TableHead>
                              <TableHead className="text-center">Tipo</TableHead>
                              <TableHead className="text-center">Participantes</TableHead>
                              <TableHead className="text-center">Mensajes</TableHead>
                              <TableHead className="text-center">Míos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {backupChats.map((chat, idx) => (
                              <TableRow key={idx} className={cn(!chat.selected && "opacity-50")}>
                                <TableCell>
                                  <Checkbox
                                    checked={chat.selected}
                                    onCheckedChange={(checked) =>
                                      setBackupChats(prev =>
                                        prev.map((c, i) => i === idx ? { ...c, selected: !!checked } : c)
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {chat.isGroup ? (
                                      <Users className="w-4 h-4 text-primary shrink-0" />
                                    ) : (
                                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                    )}
                                    <span className="text-sm font-medium truncate max-w-[200px]">
                                      {chat.chatName}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={chat.isGroup ? "default" : "secondary"} className="text-xs">
                                    {chat.isGroup ? "Grupo" : "Individual"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center text-xs text-muted-foreground">
                                  {chat.speakers.size}
                                </TableCell>
                                <TableCell className="text-center text-xs text-muted-foreground">
                                  {chat.totalMessages}
                                </TableCell>
                                <TableCell className="text-center text-xs text-muted-foreground">
                                  {chat.myMessages}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleBackupImport} disabled={backupImporting || backupChats.filter(c => c.selected).length === 0}>
                          {backupImporting ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Upload className="w-4 h-4 mr-2" />
                          )}
                          Importar {backupChats.filter(c => c.selected).length} chats
                        </Button>
                        <Button variant="outline" onClick={resetBackupImport}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {backupStep === 'importing' && (
                    <div className="flex items-center gap-3 p-6 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Importando chats y enriqueciendo contactos...</span>
                    </div>
                  )}

                  {backupStep === 'done' && backupResults && (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                        <div className="flex items-center gap-2 mb-1">
                          <Check className="w-5 h-5 text-primary" />
                          <span className="font-medium text-primary">Importación completada</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {backupResults.imported} chats procesados · {backupResults.newContacts} contactos nuevos · {backupResults.groupsProcessed} grupos analizados
                        </p>
                      </div>
                      <Button variant="outline" onClick={resetBackupImport}>
                        Importar más
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <User className="w-4 h-4 text-primary" />
                      Vincular a contacto
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={waContactMode === "existing" ? "default" : "outline"}
                        onClick={() => setWaContactMode("existing")}
                      >
                        Contacto existente
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={waContactMode === "new" ? "default" : "outline"}
                        onClick={() => setWaContactMode("new")}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Crear nuevo
                      </Button>
                    </div>
                    {waContactMode === "existing" ? (
                      <Popover open={contactSearchOpen} onOpenChange={setContactSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            {waSelectedContact
                              ? existingContacts.find(c => c.id === waSelectedContact)?.name
                              : "Buscar contacto..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Escribe para buscar..." />
                            <CommandList>
                              <CommandEmpty>No se encontró ningún contacto.</CommandEmpty>
                              <CommandGroup>
                                {existingContacts.map((c) => (
                                  <CommandItem key={c.id} value={c.name} onSelect={() => {
                                    setWaSelectedContact(c.id);
                                    setContactSearchOpen(false);
                                  }}>
                                    <Check className={cn("mr-2 h-4 w-4",
                                      waSelectedContact === c.id ? "opacity-100" : "opacity-0")} />
                                    {c.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Input
                        placeholder="Nombre del nuevo contacto..."
                        value={waNewContactName}
                        onChange={(e) => setWaNewContactName(e.target.value)}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Input
                      type="file"
                      accept=".txt,.csv,.pdf,.zip"
                      onChange={(e) => setWaFile(e.target.files?.[0] || null)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleWhatsAppImport}
                      disabled={!waFile || waProcessing || (waContactMode === "existing" ? !waSelectedContact : !waNewContactName.trim())}
                    >
                      {waProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Importar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formatos soportados: .txt, .csv, .pdf, .zip (WhatsApp → Exportar chat)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audio Tab */}
        <TabsContent value="audio">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                Importar Audio
              </CardTitle>
              <CardDescription>
                Sube una grabación de audio. Se transcribirá automáticamente y se detectarán los hablantes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                <Button
                  onClick={handleAudioImport}
                  disabled={!audioFile || audioProcessing}
                >
                  {audioProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Transcribir
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Formatos soportados: MP3, M4A, WAV, OGG, WebM
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plaud Tab */}
        <TabsContent value="plaud">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Importar Transcripción Plaud
              </CardTitle>
              <CardDescription>
                Sube un resumen o transcripción exportada desde Plaud Note.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".txt,.md,.json"
                  onChange={(e) => setPlaudFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                <Button
                  onClick={handlePlaudImport}
                  disabled={!plaudFile || plaudProcessing}
                >
                  {plaudProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Importar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Acepta archivos .txt, .md o .json exportados desde Plaud
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results & Contact Review */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Resultados de importación</h2>

          {results.map((result, ri) => (
            <Card key={ri}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {typeIcons[result.type]}
                    <Badge variant="secondary">{typeLabels[result.type]}</Badge>
                    <span className="text-muted-foreground font-normal text-sm">
                      {result.fileName}
                    </span>
                  </CardTitle>
                  {result.contacts.filter((c) => !c.confirmed).length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirmAllContacts(ri)}
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Confirmar todos
                    </Button>
                  )}
                </div>
                {result.summary && (
                  <CardDescription>{result.summary}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {result.contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No se detectaron contactos nuevos
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground mb-2">
                      Contactos detectados — revisa y confirma:
                    </p>
                    {result.contacts.map((contact, ci) => (
                      <div
                        key={ci}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border"
                      >
                        <UserPlus className="w-4 h-4 text-muted-foreground shrink-0" />
                        {contact.editing ? (
                          <Input
                            value={contact.name}
                            onChange={(e) =>
                              updateContactName(ri, ci, e.target.value)
                            }
                            onBlur={() => toggleContactEdit(ri, ci)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && toggleContactEdit(ri, ci)
                            }
                            className="h-8 flex-1"
                            autoFocus
                          />
                        ) : (
                          <span className="flex-1 text-sm text-foreground">
                            {contact.name}
                          </span>
                        )}
                        {contact.role && (
                          <Badge variant="outline" className="text-xs">
                            {contact.role}
                          </Badge>
                        )}
                        {contact.confirmed ? (
                          <Badge className="bg-primary/20 text-primary border-0">
                            <Check className="w-3 h-3 mr-1" />
                            Creado
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => markAsMySelf(ri, ci)}
                              title="Marcar como yo"
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1" />
                              Soy yo
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => toggleContactEdit(ri, ci)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-primary hover:text-primary"
                              onClick={() => confirmContact(ri, ci)}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeContact(ri, ci)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {result.transcription && (
                  <details className="mt-4">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      Ver transcripción
                    </summary>
                    <pre className="mt-2 p-3 bg-muted rounded-lg text-xs text-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {result.transcription}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
};

export default DataImport;
