import { useState, useEffect, useCallback, useRef } from "react";
import { cn, isValidContactName } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  Mail,
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
} from "lucide-react";
import { extractTextFromFile, parseBackupCSVByChat, extractMessagesFromBackupCSV, extractMessagesFromWhatsAppTxt, type ParsedBackupChat, type ParsedMessage } from "@/lib/whatsapp-file-extract";
import { convertXlsxToCSVText, convertContactsXlsxToCSVText } from "@/lib/xlsx-utils";
import { detectBlockFormat, parseBlockFormatTxt, parseBlockFormatByChat } from "@/lib/whatsapp-block-parser";
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

/** Find or create a contact, preventing duplicates using a mutable Map */
async function findOrCreateContact(
  userId: string,
  name: string,
  contactsMap: Map<string, ExistingContact>,
  context: string,
  brain: string = 'personal',
  metadata?: Record<string, unknown>
): Promise<{ id: string; name: string; isNew: boolean }> {
  // Check mutable Map first (synchronous, no stale state)
  const normalizedName = name.toLowerCase().trim().replace(/\s+/g, ' ');
  
  // Exact match
  if (contactsMap.has(normalizedName)) {
    const existing = contactsMap.get(normalizedName)!;
    return { id: existing.id, name: existing.name, isNew: false };
  }
  
  // Partial match
  for (const [key, contact] of contactsMap.entries()) {
    if (key.includes(normalizedName) || normalizedName.includes(key)) {
      return { id: contact.id, name: contact.name, isNew: false };
    }
  }

  // Skip invalid contact names (phone numbers, emojis, symbols)
  if (!isValidContactName(name)) {
    return { id: '', name: name.trim(), isNew: false };
  }

  const insertData: any = {
    user_id: userId,
    name: name.trim().replace(/\s+/g, ' '),
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
  
  // Immediately update the mutable Map (synchronous!)
  contactsMap.set(normalizedName, { id: newContact.id, name: newContact.name });
  
  return { id: newContact.id, name: newContact.name, isNew: true };
}

// ── Upload helpers ──────────────────────────────────────────────────────────

const buildImportUploadPayload = async (csvText: string) => {
  const plainBlob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  if (typeof CompressionStream === 'undefined') {
    return { blob: plainBlob, compressed: false, suffix: '' };
  }

  try {
    const compressedStream = plainBlob.stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(compressedStream).blob();
    if (compressedBlob.size > 0 && compressedBlob.size < plainBlob.size) {
      return { blob: compressedBlob, compressed: true, suffix: '.gz' };
    }
  } catch (e) {
    console.warn('[BackupImport] gzip compression failed, using plain CSV', e);
  }

  return { blob: plainBlob, compressed: false, suffix: '' };
};

// ── Main Component ───────────────────────────────────────────────────────────

const DataImport = () => {
  const { user } = useAuth();
  const { profile, updateProfile } = useUserProfile();
  const [results, setResults] = useState<ImportResult[]>([]);

  // ---- Existing contacts ----
  const [existingContacts, setExistingContacts] = useState<ExistingContact[]>([]);
  const contactsMapRef = useRef<Map<string, ExistingContact>>(new Map());

  useEffect(() => {
    if (!user) return;
    const fetchContacts = async () => {
      const { data } = await (supabase as any)
        .from("people_contacts")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name")
        .limit(5000);
      if (data) {
        setExistingContacts(data);
        // Populate the mutable Map for synchronous lookups during import
        const map = new Map<string, ExistingContact>();
        for (const c of data) {
          const key = c.name.toLowerCase().trim().replace(/\s+/g, ' ');
          map.set(key, c);
        }
        contactsMapRef.current = map;
      }
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
      const isXlsx = csvFile.name.toLowerCase().match(/\.xlsx?$/);
      const text = isXlsx ? await convertContactsXlsxToCSVText(csvFile) : await csvFile.text();
      const parsed = parseContactsCSV(text);
      setCsvParsed(parsed);
      if (parsed.length === 0) toast.error("No se detectaron contactos en el archivo");
    } catch {
      toast.error("Error al leer el archivo de contactos");
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
  const [waImportMode, setWaImportMode] = useState<'bulk' | 'individual' | 'backup' | 'live'>('live');

  // ---- WhatsApp Business Live ----
  const [waLiveStats, setWaLiveStats] = useState<{
    lastMessage: string | null;
    messages24h: number;
    linkedContacts: number;
    totalContacts: number;
    totalMessages: number;
    recentMessages: Array<{ sender: string | null; content: string; message_date: string | null }>;
  } | null>(null);
  const [waLiveLoading, setWaLiveLoading] = useState(false);
  const [waWebhookStatus, setWaWebhookStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [waLastChecked, setWaLastChecked] = useState<Date | null>(null);
  const [waTimeAgo, setWaTimeAgo] = useState('');

  const loadWaLiveStats = useCallback(async () => {
    if (!user) return;
    setWaLiveLoading(true);
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [lastMsgRes, count24hRes, linkedRes, totalRes, totalMsgRes, recentMsgRes] = await Promise.all([
        (supabase as any)
          .from('contact_messages')
          .select('message_date')
          .eq('user_id', user.id)
          .eq('source', 'whatsapp')
          .not('message_date', 'is', null)
          .order('message_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from('contact_messages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('source', 'whatsapp')
          .gte('message_date', yesterday),
        (supabase as any)
          .from('people_contacts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .not('wa_id', 'is', null),
        (supabase as any)
          .from('people_contacts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        (supabase as any)
          .from('contact_messages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('source', 'whatsapp'),
        (supabase as any)
          .from('contact_messages')
          .select('sender, content, message_date')
          .eq('user_id', user.id)
          .eq('source', 'whatsapp')
          .order('message_date', { ascending: false })
          .limit(5),
      ]);

      setWaLiveStats({
        lastMessage: lastMsgRes.data?.message_date || null,
        messages24h: count24hRes.count || 0,
        linkedContacts: linkedRes.count || 0,
        totalContacts: totalRes.count || 0,
        totalMessages: totalMsgRes.count || 0,
        recentMessages: recentMsgRes.data || [],
      });
      setWaLastChecked(new Date());
    } catch (err) {
      console.error('Error loading WA live stats:', err);
    } finally {
      setWaLiveLoading(false);
    }
  }, [user]);

  const checkWebhook = useCallback(async () => {
    setWaWebhookStatus('checking');
    try {
      const url = `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=jarvis-verify-token&hub.challenge=test123`;
      const res = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const text = await res.text();
      setWaWebhookStatus(text.trim() === 'test123' ? 'ok' : 'error');
    } catch {
      setWaWebhookStatus('error');
    }
  }, []);

  useEffect(() => {
    if (waImportMode === 'live' && user) {
      loadWaLiveStats();
      checkWebhook();
    }
  }, [waImportMode, user, loadWaLiveStats, checkWebhook]);

  // Realtime subscription for auto-sync
  useEffect(() => {
    if (waImportMode !== 'live' || !user) return;
    const channel = supabase.channel('wa-live-sync')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contact_messages',
        filter: 'source=eq.whatsapp',
      }, () => {
        loadWaLiveStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [waImportMode, user, loadWaLiveStats]);

  // Auto-refresh time ago label
  useEffect(() => {
    if (!waLastChecked) return;
    const update = () => {
      const secs = Math.round((Date.now() - waLastChecked.getTime()) / 1000);
      if (secs < 60) setWaTimeAgo('hace unos segundos');
      else if (secs < 3600) setWaTimeAgo(`hace ${Math.floor(secs / 60)} min`);
      else setWaTimeAgo(`hace ${Math.floor(secs / 3600)}h`);
    };
    update();
    const iv = setInterval(update, 30000);
    return () => clearInterval(iv);
  }, [waLastChecked]);
  const [waBulkFiles, setWaBulkFiles] = useState<File[]>([]);
  const [waParsedChats, setWaParsedChats] = useState<ParsedChat[]>([]);
  const [waBulkStep, setWaBulkStep] = useState<'select' | 'review' | 'importing' | 'done'>('select');
  const [waBulkAnalyzing, setWaBulkAnalyzing] = useState(false);
  const [waBulkImporting, setWaBulkImporting] = useState(false);
  const [waBulkResults, setWaBulkResults] = useState<{ imported: number; newContacts: number; messagesStored: number; messagesFailed: number } | null>(null);
  const [importProgress, setImportProgress] = useState<{
    currentChat: number;
    totalChats: number;
    currentChatName: string;
    messagesStored: number;
    messagesFailed: number;
    startTime: number;
  } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!importProgress) { setElapsedSeconds(0); return; }
    const iv = setInterval(() => setElapsedSeconds(Math.round((Date.now() - importProgress.startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [importProgress]);

  // ---- Backup CSV Import (full backup with groups) ----
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupCsvText, setBackupCsvText] = useState<string>('');
  const [backupChats, setBackupChats] = useState<(ParsedBackupChat & { selected: boolean; alreadyImported: boolean })[]>([]);
  const [backupStep, setBackupStep] = useState<'select' | 'review' | 'importing' | 'done'>('select');
  const [backupAnalyzing, setBackupAnalyzing] = useState(false);
  const [backupImporting, setBackupImporting] = useState(false);
  const [backupIsBlockFormat, setBackupIsBlockFormat] = useState(false);
  const [backupResults, setBackupResults] = useState<{ imported: number; newContacts: number; groupsProcessed: number; messagesStored: number; messagesFailed: number } | null>(null);

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
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        let text: string;

        if (ext === 'xlsx' || ext === 'xls') {
          text = await convertXlsxToCSVText(file);
        } else {
          text = await extractTextFromFile(file);
        }

        // Check if it's block format TXT
        if ((ext === 'txt') && detectBlockFormat(text)) {
          const blockMessages = parseBlockFormatTxt(text, file.name.replace(/\.[^.]+$/, ''), myIdentifiers);
          const speakers = new Map<string, number>();
          let myMessageCount = 0;
          for (const m of blockMessages) {
            if (m.sender === 'Yo') { myMessageCount++; }
            else { speakers.set(m.sender, (speakers.get(m.sender) || 0) + 1); }
          }
          let detectedSpeaker = '';
          let maxCount = 0;
          speakers.forEach((count, name) => { if (count > maxCount) { maxCount = count; detectedSpeaker = name; } });
          const totalOther = Array.from(speakers.values()).reduce((a, b) => a + b, 0);
          const match = detectedSpeaker ? matchContactByName(detectedSpeaker, existingContacts) : null;
          parsed.push({ file, detectedSpeaker: detectedSpeaker || "(sin detectar)", messageCount: totalOther, myMessageCount, matchedContactId: match?.id || null, matchedContactName: match?.name || "", action: match ? 'link' : 'create' });
          continue;
        }

        const { speakers, myMessageCount } = parseWhatsAppSpeakers(text, myIdentifiers);

        let detectedSpeaker = "";
        let maxCount = 0;
        speakers.forEach((count, name) => {
          if (count > maxCount) { maxCount = count; detectedSpeaker = name; }
        });

        const totalOtherMessages = Array.from(speakers.values()).reduce((a, b) => a + b, 0);
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
    const activeChats = waParsedChats.filter(c => c.action !== 'skip');
    setImportProgress({ currentChat: 0, totalChats: activeChats.length, currentChatName: '', messagesStored: 0, messagesFailed: 0, startTime: Date.now() });

    try {
      const myIdentifiers = getMyIdentifiers();

      for (let ci = 0; ci < activeChats.length; ci++) {
        const chat = activeChats[ci];
        setImportProgress(prev => prev ? { ...prev, currentChat: ci + 1, currentChatName: chat.detectedSpeaker } : prev);

        let contactId = chat.matchedContactId;
        let contactName = chat.matchedContactName || chat.detectedSpeaker;

        // Create new contact if needed
        if (chat.action === 'create' || !contactId) {
          const result = await findOrCreateContact(
            user.id,
            chat.detectedSpeaker,
            contactsMapRef.current,
            "Importado desde WhatsApp (masivo)"
          );
          contactId = result.id;
          contactName = result.name;
          if (result.isNew) {
            newContacts++;
          }
        }

        // Parse and store actual messages in contact_messages
        const text = await extractTextFromFile(chat.file);
        const allMessages = extractMessagesFromWhatsAppTxt(text, chat.detectedSpeaker, myIdentifiers);

        if (contactId && allMessages.length > 0) {
          // Check for existing messages to avoid duplicates
          const { count: existingCount } = await (supabase as any)
            .from("contact_messages")
            .select("id", { count: "exact", head: true })
            .eq("contact_id", contactId)
            .eq("source", "whatsapp")
            .eq("chat_name", chat.detectedSpeaker);

          if (!existingCount || existingCount === 0) {
            const batchSize = 200;
            let storedOk = 0;
            let storedFail = 0;
            for (let i = 0; i < allMessages.length; i += batchSize) {
              const batch = allMessages.slice(i, i + batchSize).map(m => ({
                user_id: user.id,
                contact_id: contactId,
                source: 'whatsapp',
                sender: m.sender,
                content: m.content,
                message_date: (() => {
                  if (!m.messageDate) return null;
                  try {
                    const normalized = String(m.messageDate).replace(' ', 'T');
                    const d = new Date(normalized);
                    return isNaN(d.getTime()) ? null : d.toISOString();
                  } catch { return null; }
                })(),
                chat_name: chat.detectedSpeaker,
                direction: m.direction,
              }));
              const { error: insertError } = await (supabase as any).from("contact_messages").insert(batch);
              if (insertError) {
                console.warn(`[WhatsApp Bulk] Batch failed (${batch.length} msgs), retrying in smaller chunks...`, insertError.message);
                const smallBatch = 50;
                for (let j = 0; j < batch.length; j += smallBatch) {
                  const mini = batch.slice(j, j + smallBatch);
                  const { error: retryErr } = await (supabase as any).from("contact_messages").insert(mini);
                  if (retryErr) {
                    console.error(`[WhatsApp Bulk] Mini-batch failed (${mini.length} msgs):`, retryErr.message);
                    storedFail += mini.length;
                    setImportProgress(prev => prev ? { ...prev, messagesFailed: prev.messagesFailed + mini.length } : prev);
                  } else {
                    storedOk += mini.length;
                    setImportProgress(prev => prev ? { ...prev, messagesStored: prev.messagesStored + mini.length } : prev);
                  }
                }
              } else {
                storedOk += batch.length;
                setImportProgress(prev => prev ? { ...prev, messagesStored: prev.messagesStored + batch.length } : prev);
              }
            }
            console.log(`[WhatsApp Bulk] ${chat.detectedSpeaker}: ${storedOk}/${allMessages.length} msgs stored, ${storedFail} failed`);
          }

          // Update wa_message_count and last_contact
          const { count: totalMsgs } = await (supabase as any)
            .from("contact_messages")
            .select("id", { count: "exact", head: true })
            .eq("contact_id", contactId)
            .eq("source", "whatsapp");

          const lastMsg = allMessages.reduce((latest: string | null, m: any) => {
            const d = m.messageDate;
            if (!d) return latest;
            return (!latest || d > latest) ? d : latest;
          }, null);

          await (supabase as any)
            .from("people_contacts")
            .update({
              wa_message_count: totalMsgs || allMessages.length,
              last_contact: lastMsg || undefined,
            })
            .eq("id", contactId);
        }

        // Add to results for contact review
        const { speakers } = parseWhatsAppSpeakers(text, myIdentifiers);
        const contacts: DetectedContact[] = Array.from(speakers.keys())
          .filter(name => name !== chat.detectedSpeaker)
          .map(name => ({ name, role: "Contacto WhatsApp", confirmed: false, editing: false }));

        const summaryParts = [];
        if (chat.myMessageCount > 0) summaryParts.push(`${chat.myMessageCount} tuyos`);
        if (allMessages.length > 0) summaryParts.push(`${allMessages.length} mensajes guardados`);
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

      setWaBulkResults({ imported, newContacts, messagesStored: importProgress?.messagesStored || 0, messagesFailed: importProgress?.messagesFailed || 0 });
      setWaBulkStep('done');
      setImportProgress(null);
      setExistingContacts(prev => [...prev].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`${imported} chats importados, ${newContacts} contactos nuevos creados`);
    } catch (err) {
      console.error(err);
      toast.error("Error durante la importación masiva");
      setWaBulkStep('review');
    } finally {
      setWaBulkImporting(false);
      setImportProgress(null);
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

    // Batch insert in chunks of 200 with error handling
    const batchSize = 200;
    let storedOk = 0;
    let storedFail = 0;
    for (let i = 0; i < filteredMessages.length; i += batchSize) {
      const batch = filteredMessages.slice(i, i + batchSize).map(m => ({
        user_id: userId,
        contact_id: contactId,
        source: 'whatsapp',
        sender: m.sender,
        content: m.content,
        message_date: (() => {
          if (!m.messageDate) return null;
          try {
            const normalized = String(m.messageDate).replace(' ', 'T');
            const d = new Date(normalized);
            return isNaN(d.getTime()) ? null : d.toISOString();
          } catch { return null; }
        })(),
        chat_name: m.chatName,
        direction: m.direction,
      }));

      const { error: insertError } = await (supabase as any).from("contact_messages").insert(batch);
      if (insertError) {
        console.warn(`[Backup Import] Batch failed (${batch.length} msgs for "${chatName}"), retrying...`, insertError.message);
        const smallBatch = 50;
        for (let j = 0; j < batch.length; j += smallBatch) {
          const mini = batch.slice(j, j + smallBatch);
          const { error: retryErr } = await (supabase as any).from("contact_messages").insert(mini);
          if (retryErr) {
            console.error(`[Backup Import] Mini-batch failed (${mini.length} msgs):`, retryErr.message);
            storedFail += mini.length;
          } else {
            storedOk += mini.length;
          }
        }
      } else {
        storedOk += batch.length;
      }
    }
    console.log(`[Backup Import] "${chatName}": ${storedOk}/${filteredMessages.length} msgs stored, ${storedFail} failed`);

    // Update last_contact with the most recent message date
    const lastMsg = filteredMessages.reduce((latest: string | null, m: any) => {
      const d = m.messageDate || m.message_date;
      if (!d) return latest;
      return (!latest || d > latest) ? d : latest;
    }, null);
    if (lastMsg) {
      await (supabase as any).from("people_contacts").update({ last_contact: lastMsg }).eq("id", contactId);
    }
  };

  const handleBackupAnalyze = async () => {
    if (!backupFile || !user) return;
    setBackupAnalyzing(true);
    try {
      const isXlsx = backupFile.name.toLowerCase().match(/\.xlsx?$/);
      const text = isXlsx ? await convertXlsxToCSVText(backupFile) : await backupFile.text();
      setBackupCsvText(text);
      const myIdentifiers = getMyIdentifiers();

      // Detect block format (TXT with ---- separators) vs CSV
      const isBlock = !isXlsx && detectBlockFormat(text.slice(0, 10000));
      setBackupIsBlockFormat(isBlock);

      const chats = isBlock
        ? parseBlockFormatByChat(text, myIdentifiers)
        : parseBackupCSVByChat(text, myIdentifiers);

      if (chats.length === 0) {
        const debugLines = text.split('\n').slice(0, 5);
        console.warn('[BackupAnalyze] No backup format detected. First 5 lines:', debugLines);
        toast.error("No se detectó formato de backup de WhatsApp. Revisa la consola para detalles.");
        return;
      }

      // Query existing chat_names to detect already-imported sessions
      // We query distinct chat_names by selecting with a limit high enough
      // Query existing chat_names to detect already-imported sessions
      const existingChatNames = new Set<string>();
      const allChatNames = chats.map(c => c.chatName);
      const checkBatchSize = 50;
      
      for (let i = 0; i < allChatNames.length; i += checkBatchSize) {
        const batch = allChatNames.slice(i, i + checkBatchSize);
        const { data } = await supabase
          .from('contact_messages')
          .select('chat_name')
          .eq('user_id', user.id)
          .in('chat_name', batch)
          .limit(batch.length);
        
        if (data) {
          for (const row of data) {
            if (row.chat_name) existingChatNames.add(row.chat_name.toLowerCase().trim());
          }
        }
      }

      const chatsWithStatus = chats.map(c => {
        const alreadyImported = existingChatNames.has(c.chatName.toLowerCase().trim());
        return { ...c, selected: !alreadyImported, alreadyImported };
      });

      setBackupChats(chatsWithStatus);
      setBackupStep('review');
      const newCount = chatsWithStatus.filter(c => !c.alreadyImported).length;
      const existingCount = chatsWithStatus.filter(c => c.alreadyImported).length;
      toast.success(`${chats.length} conversaciones: ${newCount} nuevas, ${existingCount} ya importadas`);
    } catch (err) {
      console.error(err);
      toast.error("Error al analizar el backup");
    } finally {
      setBackupAnalyzing(false);
    }
  };

  // ---- Background import job polling ----
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{
    status: string;
    total_chats: number;
    processed_chats: number;
    messages_stored: number;
    messages_failed: number;
    contacts_created: number;
    error_message: string | null;
  } | null>(null);

  // Poll for active jobs on mount
  useEffect(() => {
    if (!user) return;
    const checkActiveJobs = async () => {
      const { data } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setActiveJobId(data.id);
        setJobProgress({
          status: data.status,
          total_chats: data.total_chats || 0,
          processed_chats: data.processed_chats || 0,
          messages_stored: data.messages_stored || 0,
          messages_failed: data.messages_failed || 0,
          contacts_created: data.contacts_created || 0,
          error_message: data.error_message,
        });
        setBackupStep('importing');
      }
    };
    checkActiveJobs();
  }, [user]);

  // Poll active job progress
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('id', activeJobId)
        .single();
      if (!data) return;
      setJobProgress({
        status: data.status,
        total_chats: data.total_chats || 0,
        processed_chats: data.processed_chats || 0,
        messages_stored: data.messages_stored || 0,
        messages_failed: data.messages_failed || 0,
        contacts_created: data.contacts_created || 0,
        error_message: data.error_message,
      });
      if (data.status === 'done' || data.status === 'error' || data.status === 'cancelled') {
        clearInterval(interval);
        if (data.status === 'done') {
          setBackupResults({
            imported: data.processed_chats || 0,
            newContacts: data.contacts_created || 0,
            groupsProcessed: 0,
            messagesStored: data.messages_stored || 0,
            messagesFailed: data.messages_failed || 0,
          });
          setBackupStep('done');
          toast.success(`Importación completada: ${data.processed_chats} chats, ${data.messages_stored?.toLocaleString()} mensajes`);
        } else if (data.status === 'error') {
          toast.error(`Error en importación: ${data.error_message}`);
          setBackupStep('review');
        }
        setActiveJobId(null);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeJobId]);

  const handleBackupImport = async () => {
    if (!user || !backupFile) return;
    setBackupImporting(true);
    setBackupStep('importing');

    try {
      // 1. Parse client-side (already in memory from analysis step)
      const csvText = backupCsvText || (backupFile.name.toLowerCase().match(/\.xlsx?$/)
        ? await convertXlsxToCSVText(backupFile)
        : await backupFile.text());

      const myIdentifiers = getMyIdentifiers();
      const selectedChatNames = new Set(backupChats.filter(c => c.selected).map(c => c.chatName));
      const allMessages = backupIsBlockFormat
        ? parseBlockFormatTxt(csvText, '', myIdentifiers)
        : extractMessagesFromBackupCSV(csvText, null, myIdentifiers);

      // Group messages by chat
      const chatMessagesMap = new Map<string, {
        messages: Array<{ sender: string; content: string; messageDate: string | null; direction: 'incoming' | 'outgoing' | 'notification' }>;
        speakers: Record<string, number>;
        isGroup: boolean;
      }>();

      for (const msg of allMessages) {
        if (!selectedChatNames.has(msg.chatName)) continue;
        if (!chatMessagesMap.has(msg.chatName)) {
          chatMessagesMap.set(msg.chatName, { messages: [], speakers: {}, isGroup: false });
        }
        const chat = chatMessagesMap.get(msg.chatName)!;
        chat.messages.push({
          sender: msg.sender,
          content: msg.content,
          messageDate: msg.messageDate,
          direction: msg.direction,
        });
        if (msg.sender !== 'Yo') {
          chat.speakers[msg.sender] = (chat.speakers[msg.sender] || 0) + 1;
        }
      }

      // Set isGroup
      for (const chat of chatMessagesMap.values()) {
        chat.isGroup = Object.keys(chat.speakers).length >= 2;
      }

      // 2. Create import_jobs row
      const selectedCount = chatMessagesMap.size;
      const { data: jobData, error: jobErr } = await supabase
        .from('import_jobs')
        .insert({
          user_id: user.id,
          job_type: 'whatsapp_backup',
          status: 'pending',
          file_name: backupFile.name,
          total_chats: selectedCount,
          metadata: { selected_chats: Array.from(selectedChatNames) },
        })
        .select('id')
        .single();

      if (jobErr || !jobData) throw new Error(`Job creation failed: ${jobErr?.message}`);

      setActiveJobId(jobData.id);
      setJobProgress({
        status: 'pending',
        total_chats: selectedCount,
        processed_chats: 0,
        messages_stored: 0,
        messages_failed: 0,
        contacts_created: 0,
        error_message: null,
      });

      // 3. Build batches of ~20 chats and send sequentially to edge function
      const CHATS_PER_BATCH = 20;
      const chatEntries = Array.from(chatMessagesMap.entries());
      const totalBatches = Math.ceil(chatEntries.length / CHATS_PER_BATCH);

      toast.success(`Importando ${selectedCount} chats en ${totalBatches} lotes...`);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      // Send batches sequentially (fire-and-forget style but sequential to avoid overload)
      const sendBatches = async () => {
        for (let b = 0; b < totalBatches; b++) {
          const batchChats = chatEntries.slice(b * CHATS_PER_BATCH, (b + 1) * CHATS_PER_BATCH);
          const payload = {
            job_id: jobData.id,
            batch_index: b,
            total_batches: totalBatches,
            chats: batchChats.map(([chatName, data]) => ({
              chatName,
              isGroup: data.isGroup,
              speakers: data.speakers,
              messages: data.messages,
            })),
          };

          try {
            const resp = await fetch(`${supabaseUrl}/functions/v1/import-whatsapp-backup`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify(payload),
            });
            if (!resp.ok) {
              const errText = await resp.text();
              console.warn(`[BackupImport] Batch ${b + 1}/${totalBatches} failed:`, errText);
            }
          } catch (err) {
            console.warn(`[BackupImport] Batch ${b + 1}/${totalBatches} error:`, err);
          }
        }
      };

      // Fire-and-forget the batch sending (runs in background)
      sendBatches().catch(err => console.error('[BackupImport] Batch sending failed:', err));

    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Error al iniciar la importación');
      setBackupStep('review');
    } finally {
      setBackupImporting(false);
    }
  };

  const cancelImportJob = async () => {
    if (!activeJobId) return;
    await supabase.from('import_jobs').update({
      status: 'cancelled',
      error_message: 'Cancelado por el usuario',
      updated_at: new Date().toISOString(),
    }).eq('id', activeJobId);
    setActiveJobId(null);
    setJobProgress(null);
    setBackupStep('select');
    toast.info('Importación cancelada');
  };

  const resetBackupImport = () => {
    setBackupFile(null);
    setBackupCsvText('');
    setBackupChats([]);
    setBackupStep('select');
    setBackupResults(null);
  };

  const standardWhatsAppParse = async (
    text: string, myIdentifiers: string[], contactId: string, contactName: string, userId: string
  ): Promise<{ speakers: Map<string, number>; myMessageCount: number; storedCount: number }> => {
    const { speakers, myMessageCount } = parseWhatsAppSpeakers(text, myIdentifiers);
    const otherCount = Array.from(speakers.values()).reduce((a, b) => a + b, 0);
    const total = myMessageCount + otherCount;

    if (contactId && total > 0) {
      await (supabase as any).from("people_contacts").update({ wa_message_count: total }).eq("id", contactId);
    }

    let storedCount = 0;
    if (contactId) {
      const { extractMessagesFromWhatsAppTxt } = await import("@/lib/whatsapp-file-extract");
      const parsedMessages = extractMessagesFromWhatsAppTxt(text, contactName, myIdentifiers);
      storedCount = parsedMessages.length;
      const batchSize = 200;
      let storedOk = 0;
      let storedFail = 0;
      for (let i = 0; i < parsedMessages.length; i += batchSize) {
        const batch = parsedMessages.slice(i, i + batchSize).map(m => ({
          user_id: userId, contact_id: contactId, source: 'whatsapp',
          sender: m.sender, content: m.content, message_date: m.messageDate || null,
          chat_name: m.chatName, direction: m.direction,
        }));
        const { error: insertError } = await (supabase as any).from("contact_messages").insert(batch);
        if (insertError) {
          console.warn(`[Individual Import] Batch failed, retrying...`, insertError.message);
          const smallBatch = 50;
          for (let j = 0; j < batch.length; j += smallBatch) {
            const mini = batch.slice(j, j + smallBatch);
            const { error: retryErr } = await (supabase as any).from("contact_messages").insert(mini);
            if (retryErr) { storedFail += mini.length; } else { storedOk += mini.length; }
          }
        } else { storedOk += batch.length; }
      }
      console.log(`[Individual Import] ${contactName}: ${storedOk}/${parsedMessages.length} msgs stored, ${storedFail} failed`);
      // Update last_contact
      const lastMsg = parsedMessages.reduce((latest: string | null, m: any) => {
        const d = m.messageDate;
        return (d && (!latest || d > latest)) ? d : latest;
      }, null);
      if (contactId && lastMsg) {
        await (supabase as any).from("people_contacts").update({ last_contact: lastMsg }).eq("id", contactId);
      }
    }
    return { speakers, myMessageCount, storedCount };
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
          contactsMapRef.current,
          "Importado desde WhatsApp"
        );
        linkedContactId = result.id;
        linkedContactName = result.name;
        if (result.isNew) {
          setExistingContacts((prev) => [...prev, { id: result.id, name: result.name }].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }

      const myIdentifiers = getMyIdentifiers();
      const ext = waFile.name.split('.').pop()?.toLowerCase() || '';
      const isCSV = ext === 'csv';
      const isXlsx = ext === 'xlsx' || ext === 'xls';
      let speakers = new Map<string, number>();
      let myMessageCount = 0;
      let storedCount = 0;

      if (isCSV || isXlsx) {
        // Try backup format (CSV or XLSX with 12 columns)
        const rawText = isXlsx ? await convertXlsxToCSVText(waFile) : await waFile.text();
        const backupChats = parseBackupCSVByChat(rawText, myIdentifiers);

        if (backupChats.length > 0) {
          const targetChat = backupChats.length === 1
            ? backupChats[0]
            : backupChats.find(c => c.chatName.toLowerCase().includes(linkedContactName.toLowerCase())) || backupChats[0];

          speakers = targetChat.speakers;
          myMessageCount = targetChat.myMessages;
          const totalMessageCount = targetChat.totalMessages;

          if (linkedContactId && totalMessageCount > 0) {
            await (supabase as any)
              .from("people_contacts")
              .update({ wa_message_count: totalMessageCount })
              .eq("id", linkedContactId);
          }

          const parsedMessages = extractMessagesFromBackupCSV(rawText, targetChat.chatName, myIdentifiers);
          storedCount = parsedMessages.length;

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
          // Update last_contact for xlsx/csv import
          const lastMsg = parsedMessages.reduce((latest: string | null, m: any) => {
            const d = m.messageDate;
            return (d && (!latest || d > latest)) ? d : latest;
          }, null);
          if (linkedContactId && lastMsg) {
            await (supabase as any).from("people_contacts").update({ last_contact: lastMsg }).eq("id", linkedContactId);
          }
        } else {
          const text = isXlsx ? rawText : await extractTextFromFile(waFile);
          ({ speakers, myMessageCount, storedCount } = await standardWhatsAppParse(text, myIdentifiers, linkedContactId, linkedContactName, user.id));
        }
      } else {
        // Standard .txt/.pdf/.zip parsing - check for block format first
        const text = await extractTextFromFile(waFile);

        if (ext === 'txt' && detectBlockFormat(text)) {
          const blockMessages = parseBlockFormatTxt(text, linkedContactName, myIdentifiers);
          for (const m of blockMessages) {
            if (m.sender === 'Yo') myMessageCount++;
            else speakers.set(m.sender, (speakers.get(m.sender) || 0) + 1);
          }
          storedCount = blockMessages.length;

          if (linkedContactId) {
            const total = myMessageCount + Array.from(speakers.values()).reduce((a, b) => a + b, 0);
            if (total > 0) {
              await (supabase as any).from("people_contacts").update({ wa_message_count: total }).eq("id", linkedContactId);
            }
            const batchSize = 500;
            for (let i = 0; i < blockMessages.length; i += batchSize) {
              const batch = blockMessages.slice(i, i + batchSize).map(m => ({
                user_id: user.id, contact_id: linkedContactId, source: 'whatsapp',
                sender: m.sender, content: m.content, message_date: m.messageDate || null,
                chat_name: m.chatName, direction: m.direction,
              }));
              await (supabase as any).from("contact_messages").insert(batch);
            }
            // Update last_contact for block format
            const lastMsg = blockMessages.reduce((latest: string | null, m: any) => {
              const d = m.messageDate;
              return (d && (!latest || d > latest)) ? d : latest;
            }, null);
            if (lastMsg) {
              await (supabase as any).from("people_contacts").update({ last_contact: lastMsg }).eq("id", linkedContactId);
            }
          }
        } else {
          ({ speakers, myMessageCount, storedCount } = await standardWhatsAppParse(text, myIdentifiers, linkedContactId, linkedContactName, user.id));
        }
      }

      const otherMessageCount = Array.from(speakers.values()).reduce((a, b) => a + b, 0);
      const totalMessageCount = myMessageCount + otherMessageCount;

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

  // ---- Email Sync ----
  const [emailSyncing, setEmailSyncing] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);

  const fetchEmailAccounts = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('email_accounts')
      .select('id, email_address, provider, is_active, last_sync_at')
      .eq('user_id', user.id);
    if (data) setEmailAccounts(data);
  }, [user]);

  useEffect(() => {
    fetchEmailAccounts();
  }, [fetchEmailAccounts]);

  const handleEmailSync = async () => {
    if (!user) return;
    setEmailSyncing(true);
    try {
      const [gmailRes, outlookRes] = await Promise.all([
        supabase.functions.invoke('email-sync', { body: { user_id: user.id, provider: 'gmail' } }),
        supabase.functions.invoke('email-sync', { body: { user_id: user.id, provider: 'outlook' } }),
      ]);

      const gmailSynced = (gmailRes.data?.results || []).reduce((acc: number, r: any) => acc + (r.synced || 0), 0);
      const outlookSynced = (outlookRes.data?.results || []).reduce((acc: number, r: any) => acc + (r.synced || 0), 0);

      if (gmailRes.error && outlookRes.error) {
        throw new Error("Error en ambas cuentas");
      }

      const parts: string[] = [];
      if (gmailRes.error) parts.push("Gmail: error");
      else parts.push(`${gmailSynced} de Gmail`);
      if (outlookRes.error) parts.push("Outlook: error");
      else parts.push(`${outlookSynced} de Outlook`);

      toast.success(`Sincronizados: ${parts.join(', ')}`);
      await fetchEmailAccounts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error al sincronizar emails");
    } finally {
      setEmailSyncing(false);
    }
  };

  // ---- Plaud Import ----
  const [plaudFile, setPlaudFile] = useState<File | null>(null);
  const [plaudProcessing, setPlaudProcessing] = useState(false);
  const [plaudFetchLoading, setPlaudFetchLoading] = useState(false);
  const [plaudTranscriptions, setPlaudTranscriptions] = useState<any[]>([]);
  const [plaudProcessingIds, setPlaudProcessingIds] = useState<Set<string>>(new Set());

  // Load existing pending plaud transcriptions
  const loadPlaudTranscriptions = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("plaud_transcriptions")
      .select("id, title, summary_structured, recording_date, context_type, processing_status, transcript_raw")
      .eq("user_id", user.id)
      .order("recording_date", { ascending: false });
    if (data) setPlaudTranscriptions(data);
  }, [user]);

  useEffect(() => { loadPlaudTranscriptions(); }, [loadPlaudTranscriptions]);

  const handlePlaudFetchFromEmail = async () => {
    if (!user) return;
    setPlaudFetchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("plaud-fetch-transcriptions", {
        body: { user_id: user.id },
      });
      if (error) throw error;
      toast.success(`${data.transcriptions_created || 0} transcripciones cargadas desde email`);
      if (data.remaining > 0) {
        toast.info(`Quedan ${data.remaining} por cargar. Pulsa de nuevo.`);
      }
      await loadPlaudTranscriptions();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error al cargar desde email");
    } finally {
      setPlaudFetchLoading(false);
    }
  };

  const updatePlaudContextType = async (id: string, contextType: string) => {
    await (supabase as any)
      .from("plaud_transcriptions")
      .update({ context_type: contextType })
      .eq("id", id);
    setPlaudTranscriptions(prev =>
      prev.map(t => t.id === id ? { ...t, context_type: contextType } : t)
    );
  };

  const processPlaudTranscription = async (transcription: any) => {
    if (!user) return;
    setPlaudProcessingIds(prev => new Set(prev).add(transcription.id));
    try {
      const { error } = await supabase.functions.invoke("plaud-intelligence", {
        body: {
          email_id: transcription.source_email_id || transcription.id,
          user_id: user.id,
          context_type: transcription.context_type || "professional",
        },
      });
      if (error) throw error;
      toast.success(`"${transcription.title}" procesada`);
      await loadPlaudTranscriptions();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error procesando: ${err.message}`);
    } finally {
      setPlaudProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(transcription.id);
        return next;
      });
    }
  };

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
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Email</span>
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
                  accept=".csv,.xlsx"
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
                  variant={waImportMode === 'live' ? 'default' : 'outline'}
                  onClick={() => setWaImportMode('live')}
                >
                  <Activity className="w-3.5 h-3.5 mr-1" />
                  WhatsApp Business (Live)
                </Button>
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
                          accept=".txt,.csv,.pdf,.zip,.xlsx"
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

                  {waBulkStep === 'importing' && importProgress && (
                    <div className="p-5 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm font-medium text-foreground truncate max-w-[280px]">
                          Importando: "{importProgress.currentChatName || '...'}"
                        </span>
                      </div>
                      <Progress value={importProgress.totalChats > 0 ? (importProgress.currentChat / importProgress.totalChats) * 100 : 0} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Chat {importProgress.currentChat} de {importProgress.totalChats}</span>
                        <span>{String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{importProgress.messagesStored.toLocaleString()} mensajes guardados</span>
                        {importProgress.messagesFailed > 0 && (
                          <span className="text-destructive">{importProgress.messagesFailed} errores</span>
                        )}
                      </div>
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
                          {waBulkResults.imported} chats importados · {waBulkResults.newContacts} contactos nuevos · {waBulkResults.messagesStored.toLocaleString()} mensajes sincronizados{waBulkResults.messagesFailed > 0 ? ` (${waBulkResults.messagesFailed.toLocaleString()} errores)` : ''}
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
                          accept=".csv,.xlsx"
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
                        {' '}<span className="font-medium text-green-500">{backupChats.filter(c => !c.alreadyImported).length}</span> nuevas,
                        {' '}<span className="font-medium text-muted-foreground">{backupChats.filter(c => c.alreadyImported).length}</span> ya importadas.
                        {' '}Selecciona cuáles importar:
                      </div>

                      <div className="flex flex-wrap gap-2 mb-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBackupChats(prev => prev.map(c => ({ ...c, selected: !c.alreadyImported })))}
                        >
                          Solo nuevos
                        </Button>
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
                          onClick={() => setBackupChats(prev => prev.map(c => ({ ...c, selected: c.isGroup && !c.alreadyImported })))}
                        >
                          Solo grupos nuevos
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30"
                          onClick={() => setBackupChats(prev => prev.map(c => ({ ...c, selected: c.alreadyImported })))}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Reimportar existentes
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
                                  <div className="flex flex-col items-center gap-1">
                                    <Badge variant={chat.isGroup ? "default" : "secondary"} className="text-xs">
                                      {chat.isGroup ? "Grupo" : "Individual"}
                                    </Badge>
                                    {chat.alreadyImported ? (
                                      <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                                        Ya importado
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs text-green-600 border-green-500/30 bg-green-500/10">
                                        Nuevo
                                      </Badge>
                                    )}
                                  </div>
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
                          {backupChats.filter(c => c.selected && c.alreadyImported).length > 0
                            ? `Reimportar ${backupChats.filter(c => c.selected).length} chats (${backupChats.filter(c => c.selected && c.alreadyImported).length} se purgarán)`
                            : `Importar ${backupChats.filter(c => c.selected).length} chats`
                          }
                        </Button>
                        <Button variant="outline" onClick={resetBackupImport}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {backupStep === 'importing' && (
                    <div className="p-5 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm font-medium text-foreground">
                          {jobProgress ? `Procesando en segundo plano...` : 'Iniciando importación...'}
                        </span>
                      </div>
                      <Progress value={jobProgress && jobProgress.total_chats > 0 ? (jobProgress.processed_chats / jobProgress.total_chats) * 100 : 0} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Chat {jobProgress?.processed_chats || 0} de {jobProgress?.total_chats || '...'}</span>
                        <span className="text-primary/70">Puedes navegar a otra página</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{(jobProgress?.messages_stored || 0).toLocaleString()} mensajes guardados</span>
                        <span>{(jobProgress?.contacts_created || 0)} contactos nuevos</span>
                        {(jobProgress?.messages_failed || 0) > 0 && (
                          <span className="text-destructive">{jobProgress?.messages_failed} errores</span>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={cancelImportJob} className="mt-2">
                        <X className="w-3.5 h-3.5 mr-1" />
                        Cancelar importación
                      </Button>
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
                          {backupResults.imported} chats procesados · {backupResults.newContacts} contactos nuevos · {backupResults.groupsProcessed} grupos · {backupResults.messagesStored.toLocaleString()} mensajes sincronizados{backupResults.messagesFailed > 0 ? ` (${backupResults.messagesFailed.toLocaleString()} errores)` : ''}
                        </p>
                      </div>
                      <Button variant="outline" onClick={resetBackupImport}>
                        Importar más
                      </Button>
                    </div>
                  )}
                </div>
              ) : waImportMode === 'live' ? (
                /* ── WhatsApp Business Live Panel ── */
                <div className="space-y-4">
                  {/* ── Global Sync Banner ── */}
                  {(() => {
                    const hasMessages = !!waLiveStats?.lastMessage;
                    const lastMsgMs = hasMessages ? Date.now() - new Date(waLiveStats!.lastMessage!).getTime() : Infinity;
                    const isActive = hasMessages && lastMsgMs < 24 * 60 * 60 * 1000;
                    const webhookOk = waWebhookStatus === 'ok';

                    if (isActive && webhookOk) {
                      return (
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-400">✓ Sincronización activa — todo al día</span>
                          <span className="ml-auto text-xs text-muted-foreground">{waTimeAgo && `Comprobado ${waTimeAgo}`}</span>
                        </div>
                      );
                    } else if (hasMessages && !isActive) {
                      const hoursAgo = Math.round(lastMsgMs / (1000 * 60 * 60));
                      return (
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                          <Activity className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">⚠ Sin actividad en las últimas {hoursAgo}h</span>
                          <span className="ml-auto text-xs text-muted-foreground">{waTimeAgo && `Comprobado ${waTimeAgo}`}</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                          <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                          <span className="text-sm font-medium text-muted-foreground">Sin datos aún — esperando primer mensaje</span>
                          <span className="ml-auto text-xs text-muted-foreground">{waTimeAgo && `Comprobado ${waTimeAgo}`}</span>
                        </div>
                      );
                    }
                  })()}

                  <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
                    {/* Stats header with refresh */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Estadísticas en vivo</span>
                      <div className="flex items-center gap-2">
                        {waTimeAgo && (
                          <span className="text-xs text-muted-foreground">Actualizado {waTimeAgo}</span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { loadWaLiveStats(); checkWebhook(); }}
                          disabled={waLiveLoading}
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", waLiveLoading && "animate-spin")} />
                        </Button>
                      </div>
                    </div>

                    {/* Stats */}
                    {waLiveLoading && !waLiveStats ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cargando estadísticas...
                      </div>
                    ) : waLiveStats ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3 rounded-lg border border-border bg-background text-center">
                            <div className="text-2xl font-bold text-foreground">{waLiveStats.totalMessages.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">Total mensajes</div>
                          </div>
                          <div className="p-3 rounded-lg border border-border bg-background text-center">
                            <div className="text-2xl font-bold text-foreground">{waLiveStats.messages24h}</div>
                            <div className="text-xs text-muted-foreground">Sincronizados (24h)</div>
                          </div>
                          <div className="p-3 rounded-lg border border-border bg-background text-center">
                            <div className="text-2xl font-bold text-foreground">{waLiveStats.linkedContacts}</div>
                            <div className="text-xs text-muted-foreground">
                              de {waLiveStats.totalContacts} con WA
                            </div>
                          </div>
                          <div className="p-3 rounded-lg border border-border bg-background text-center">
                            <div className="text-xs text-muted-foreground mb-1">Último mensaje</div>
                            <div className="text-sm font-medium text-foreground">
                              {waLiveStats.lastMessage
                                ? new Date(waLiveStats.lastMessage).toLocaleString('es-ES', {
                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid'
                                  })
                                : '—'}
                            </div>
                          </div>
                        </div>

                        {/* Contact coverage bar */}
                        {waLiveStats.totalContacts > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Cobertura WhatsApp</span>
                              <span>{Math.round((waLiveStats.linkedContacts / waLiveStats.totalContacts) * 100)}%</span>
                            </div>
                            <Progress 
                              value={(waLiveStats.linkedContacts / waLiveStats.totalContacts) * 100} 
                              className="h-2"
                            />
                            <p className="text-[10px] text-muted-foreground">Los contactos se vinculan automáticamente al recibir un mensaje de un número conocido.</p>
                          </div>
                        )}

                        {/* Recent messages diagnostic */}
                        {waLiveStats.recentMessages.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">Últimos mensajes recibidos</div>
                            <div className="space-y-1">
                              {waLiveStats.recentMessages.map((msg, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded border border-border bg-background text-xs">
                                  <span className="font-medium text-foreground truncate max-w-[120px]">{msg.sender || 'Desconocido'}</span>
                                  <span className="text-muted-foreground truncate flex-1">{msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content}</span>
                                  <span className="text-muted-foreground whitespace-nowrap shrink-0">
                                    {msg.message_date
                                      ? new Date(msg.message_date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
                                      : '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Webhook check */}
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={checkWebhook}
                        disabled={waWebhookStatus === 'checking'}
                      >
                        {waWebhookStatus === 'checking' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : waWebhookStatus === 'ok' ? (
                          <Wifi className="w-3.5 h-3.5 mr-1 text-green-500" />
                        ) : waWebhookStatus === 'error' ? (
                          <WifiOff className="w-3.5 h-3.5 mr-1 text-destructive" />
                        ) : (
                          <Wifi className="w-3.5 h-3.5 mr-1" />
                        )}
                        Verificar webhook
                      </Button>
                      {waWebhookStatus === 'ok' && (
                        <span className="text-xs text-green-600">✓ Webhook respondiendo correctamente</span>
                      )}
                      {waWebhookStatus === 'error' && (
                        <span className="text-xs text-destructive">✗ El webhook no respondió</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">Sincronización en tiempo real activa</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cada mensaje recibido o enviado vía WhatsApp Business se sincroniza automáticamente en la Red Estratégica.
                      El análisis de contactos se ejecuta automáticamente cada ~25 mensajes nuevos o al 5º mensaje del día por contacto.
                      Ya no necesitas importar archivos .txt manualmente.
                    </p>
                  </div>
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
                      accept=".txt,.csv,.pdf,.zip,.xlsx"
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
          <div className="space-y-4">
            {/* Fetch from email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Transcripciones Plaud desde Email
                </CardTitle>
                <CardDescription>
                  Descarga automáticamente las transcripciones adjuntas de los emails de Plaud
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handlePlaudFetchFromEmail} disabled={plaudFetchLoading}>
                  {plaudFetchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Cargar desde correo
                </Button>

                {/* Transcription list */}
                {plaudTranscriptions.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <p className="text-sm font-medium text-foreground">
                      {plaudTranscriptions.length} transcripciones encontradas
                    </p>
                    {plaudTranscriptions.map((t) => (
                      <div key={t.id} className="p-4 rounded-lg border border-border bg-card space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate">{t.title}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t.recording_date ? new Date(t.recording_date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "Sin fecha"}
                            </p>
                            {t.summary_structured && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {t.summary_structured.substring(0, 200).replace(/[#*_]/g, "")}...
                              </p>
                            )}
                          </div>
                          <Badge variant={t.processing_status === "completed" ? "default" : "secondary"} className="shrink-0">
                            {t.processing_status === "completed" ? "Procesada" : t.processing_status === "pending_review" ? "Pendiente" : t.processing_status}
                          </Badge>
                        </div>

                        {/* Context type selector */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Tipo:</span>
                          {["personal", "professional", "family"].map((type) => (
                            <Button
                              key={type}
                              size="sm"
                              variant={t.context_type === type ? "default" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => updatePlaudContextType(t.id, type)}
                            >
                              {type === "personal" ? "👤 Personal" : type === "professional" ? "💼 Profesional" : "👨‍👩‍👧 Familiar"}
                            </Button>
                          ))}
                        </div>

                        {/* Process button */}
                        {t.processing_status !== "completed" && (
                          <Button
                            size="sm"
                            onClick={() => processPlaudTranscription(t)}
                            disabled={plaudProcessingIds.has(t.id)}
                          >
                            {plaudProcessingIds.has(t.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Check className="w-3 h-3 mr-1" />
                            )}
                            Procesar
                          </Button>
                        )}

                        {/* Transcript preview */}
                        {t.transcript_raw && (
                          <details>
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Ver transcripción
                            </summary>
                            <pre className="mt-2 p-3 bg-muted rounded-lg text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {t.transcript_raw.substring(0, 3000)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manual upload fallback */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Subir archivo manualmente
                </CardTitle>
                <CardDescription>
                  Sube un archivo .txt, .md o .json exportado desde Plaud
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Sincronizar Emails
              </CardTitle>
              <CardDescription>
                Sincroniza correos desde tus cuentas configuradas y visualiza los últimos emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cuentas configuradas */}
              {emailAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Cuentas configuradas</p>
                  {emailAccounts.map((acc: any) => (
                    <div key={acc.id} className={cn("flex flex-col gap-1 p-3 rounded-lg border", acc.is_active ? "bg-muted/30" : "bg-destructive/5 border-destructive/20 opacity-70")}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className={cn("w-4 h-4", acc.is_active ? "text-muted-foreground" : "text-destructive/60")} />
                          <span className="text-sm font-medium">{acc.email_address}</span>
                          <Badge variant={acc.is_active ? "default" : "destructive"}>
                            {acc.is_active ? acc.provider : "Desactivada"}
                          </Badge>
                        </div>
                        {acc.is_active && acc.last_sync_at && (
                          <span className="text-xs text-muted-foreground">
                            Última sync: {new Date(acc.last_sync_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {!acc.is_active && acc.sync_error && (
                        <p className="text-xs text-destructive/80 ml-6">{acc.sync_error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {emailAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay cuentas de email configuradas.</p>
              )}

              <Button onClick={handleEmailSync} disabled={emailSyncing || emailAccounts.length === 0}>
                {emailSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sincronizar Emails
              </Button>

              <p className="text-sm text-muted-foreground">
                Los emails sincronizados se usan internamente para generar alertas sobre correos importantes, sugerencias de respuesta y vincular contactos automáticamente.
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
