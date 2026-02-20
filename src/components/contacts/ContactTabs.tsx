import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  MessageCircle, Mail, Mic, Upload, Plus, Loader2,
  ArrowDown, ArrowUp, Calendar, Search, X, FileText,
  Briefcase, Users, Globe, User, AlertTriangle,
} from 'lucide-react';
import { extractTextFromFile, extractMessagesFromWhatsAppTxt } from '@/lib/whatsapp-file-extract';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  email?: string | null;
  context?: string | null;
  wa_message_count?: number;
  metadata?: any;
  personality_profile?: any;
  category?: string | null;
  categories?: string[] | null;
  brain?: string | null;
  relationship?: string | null;
  last_contact?: string | null;
  phone_numbers?: string[] | null;
  ai_tags?: string[] | null;
  scores?: any;
  interaction_count?: number;
  sentiment?: string | null;
}

interface MessageStats {
  total: number;
  incoming: number;
  outgoing: number;
  firstDate: string | null;
  lastDate: string | null;
}

// ── WhatsApp Tab ──────────────────────────────────────────────────────────────

export function WhatsAppTab({ contact }: { contact: Contact }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStats();
  }, [contact.id]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('contact_messages')
        .select('direction, message_date')
        .eq('contact_id', contact.id)
        .eq('source', 'whatsapp')
        .order('message_date', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        setStats(null);
      } else {
        const incoming = data.filter((m: any) => m.direction === 'incoming').length;
        const outgoing = data.filter((m: any) => m.direction === 'outgoing').length;
        const dates = data.map((m: any) => m.message_date).filter(Boolean).sort();
        setStats({
          total: data.length,
          incoming,
          outgoing,
          firstDate: dates[0] || null,
          lastDate: dates[dates.length - 1] || null,
        });
      }
    } catch (err) {
      console.error('Error fetching WA stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);

    try {
      const text = await extractTextFromFile(file);
      const chatName = contact.name;

      // Get user profile for my_identifiers
      const { data: profileData } = await (supabase as any)
        .from('user_profiles')
        .select('my_identifiers')
        .eq('user_id', user.id)
        .maybeSingle();

      const myIds = profileData?.my_identifiers || ['Yo', 'yo'];
      const messages = extractMessagesFromWhatsAppTxt(text, chatName, myIds);

      if (messages.length === 0) {
        toast.error('No se encontraron mensajes en el archivo');
        return;
      }

      // Insert in batches of 500
      const batchSize = 500;
      let inserted = 0;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize).map(m => ({
          user_id: user.id,
          contact_id: contact.id,
          source: 'whatsapp',
          content: m.content,
          sender: m.sender,
          direction: m.direction,
          message_date: m.messageDate,
          chat_name: chatName,
        }));

        const { error } = await (supabase as any)
          .from('contact_messages')
          .insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }

      // Update wa_message_count
      const { count } = await (supabase as any)
        .from('contact_messages')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', contact.id)
        .eq('source', 'whatsapp');

      await (supabase as any)
        .from('people_contacts')
        .update({
          wa_message_count: count || inserted,
          last_contact: messages[messages.length - 1]?.messageDate || new Date().toISOString(),
        })
        .eq('id', contact.id);

      toast.success(`${inserted} mensajes importados para ${contact.name}`);
      fetchStats();
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Error al importar mensajes');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      {/* Import button */}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".txt,.csv,.zip,.pdf,.xlsx" className="hidden" onChange={handleImport} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex-1"
        >
          {importing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Upload className="w-4 h-4 mr-1.5" />}
          {importing ? 'Importando...' : 'Importar WhatsApp (.txt)'}
        </Button>
      </div>

      {stats ? (
        <Card className="border-green-500/20 bg-card">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-green-400 font-mono flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" /> ESTADÍSTICAS WHATSAPP
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Total</p>
                <p className="font-bold text-foreground text-lg">{stats.total}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><ArrowDown className="w-3 h-3" /> Recibidos</p>
                <p className="font-bold text-foreground text-lg">{stats.incoming}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><ArrowUp className="w-3 h-3" /> Enviados</p>
                <p className="font-bold text-foreground text-lg">{stats.outgoing}</p>
              </div>
            </div>
            {(stats.firstDate || stats.lastDate) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>
                  {stats.firstDate ? format(new Date(stats.firstDate), "d MMM yyyy", { locale: es }) : '?'}
                  {' → '}
                  {stats.lastDate ? format(new Date(stats.lastDate), "d MMM yyyy", { locale: es }) : '?'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="py-6 text-center space-y-2">
          <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Sin mensajes importados</p>
          <p className="text-xs text-muted-foreground">Exporta un chat individual de WhatsApp y súbelo aquí</p>
        </div>
      )}
    </div>
  );
}

// ── Email Tab ─────────────────────────────────────────────────────────────────

interface EmailRecord {
  id: string;
  subject: string | null;
  from_addr: string | null;
  preview: string | null;
  received_at: string | null;
  direction: string | null;
}

export function EmailTab({ contact }: { contact: Contact }) {
  const { user } = useAuth();
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [emailAddresses, setEmailAddresses] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load existing email addresses from contact
    const addresses: string[] = [];
    if (contact.email) addresses.push(contact.email);
    const meta = contact.metadata as any;
    if (meta?.emails && Array.isArray(meta.emails)) {
      for (const e of meta.emails) {
        if (e && !addresses.includes(e)) addresses.push(e);
      }
    }
    setEmailAddresses(addresses);
    if (addresses.length > 0) {
      fetchEmails(addresses);
    } else {
      setLoading(false);
    }
  }, [contact.id]);

  const fetchEmails = async (addresses: string[]) => {
    if (!user || addresses.length === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      // Search emails where from_addr or to_addr matches any of the contact's email addresses
      const orFilters = addresses.map(a => `from_addr.ilike.%${a}%,to_addr.ilike.%${a}%`).join(',');
      const { data, error } = await (supabase as any)
        .from('jarvis_emails_cache')
        .select('id, subject, from_addr, preview, received_at, direction')
        .eq('user_id', user.id)
        .or(orFilters)
        .order('received_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setEmails(data || []);
    } catch (err) {
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
    }
  };

  const addEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes('@') || !user) return;
    const addr = newEmail.trim().toLowerCase();
    if (emailAddresses.includes(addr)) { setNewEmail(''); return; }

    setSaving(true);
    try {
      const updated = [...emailAddresses, addr];
      const meta = (contact.metadata as any) || {};
      meta.emails = updated;

      await (supabase as any)
        .from('people_contacts')
        .update({
          email: updated[0], // primary email
          metadata: meta,
        })
        .eq('id', contact.id);

      setEmailAddresses(updated);
      setNewEmail('');
      fetchEmails(updated);
      toast.success(`Email ${addr} vinculado`);
    } catch {
      toast.error('Error al guardar email');
    } finally {
      setSaving(false);
    }
  };

  const removeEmail = async (addr: string) => {
    if (!user) return;
    const updated = emailAddresses.filter(e => e !== addr);
    const meta = (contact.metadata as any) || {};
    meta.emails = updated;
    await (supabase as any)
      .from('people_contacts')
      .update({
        email: updated[0] || null,
        metadata: meta,
      })
      .eq('id', contact.id);
    setEmailAddresses(updated);
    if (updated.length > 0) fetchEmails(updated);
    else setEmails([]);
  };

  return (
    <div className="space-y-3">
      {/* Add email input */}
      <div className="flex gap-2">
        <Input
          placeholder="email@ejemplo.com"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEmail()}
          className="h-8 text-sm flex-1"
        />
        <Button size="sm" variant="outline" onClick={addEmail} disabled={saving || !newEmail.includes('@')}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Linked emails */}
      {emailAddresses.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {emailAddresses.map(addr => (
            <Badge key={addr} variant="outline" className="text-xs flex items-center gap-1 pr-1">
              <Mail className="w-3 h-3" /> {addr}
              <button onClick={() => removeEmail(addr)} className="ml-0.5 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Email list */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : emails.length > 0 ? (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {emails.map(email => (
            <Card key={email.id} className="border-border bg-card">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{email.subject || '(sin asunto)'}</p>
                  {email.direction && (
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {email.direction === 'sent' ? <ArrowUp className="w-3 h-3 mr-0.5" /> : <ArrowDown className="w-3 h-3 mr-0.5" />}
                      {email.direction === 'sent' ? 'Enviado' : 'Recibido'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{email.from_addr}</p>
                {email.preview && <p className="text-xs text-muted-foreground line-clamp-2">{email.preview}</p>}
                {email.received_at && (
                  <p className="text-xs text-muted-foreground">{format(new Date(email.received_at), "d MMM yyyy HH:mm", { locale: es })}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : emailAddresses.length > 0 ? (
        <div className="py-6 text-center space-y-2">
          <Mail className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No se encontraron emails con estas direcciones</p>
        </div>
      ) : (
        <div className="py-6 text-center space-y-2">
          <Mail className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Añade una dirección de email para buscar correspondencia</p>
        </div>
      )}
    </div>
  );
}

// ── Plaud Tab (Enhanced) ──────────────────────────────────────────────────────

interface PlaudRecording {
  id: string;
  title: string | null;
  received_at: string | null;
  agent_type: string | null;
  summary: string | null;
  audio_url: string | null;
}

interface PlaudThread {
  id: string;
  event_title: string | null;
  event_date: string | null;
  recording_ids: string[] | null;
  speakers: unknown;
  agent_type: string | null;
}

export function PlaudTab({
  contact,
  contactRecordings,
  contactThreads,
}: {
  contact: Contact;
  contactRecordings: PlaudRecording[];
  contactThreads: PlaudThread[];
}) {
  const { user } = useAuth();
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [manualNotes, setManualNotes] = useState<any[]>([]);

  useEffect(() => {
    fetchManualNotes();
  }, [contact.id]);

  const fetchManualNotes = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('contact_messages')
      .select('id, content, message_date, created_at')
      .eq('contact_id', contact.id)
      .eq('source', 'manual')
      .order('created_at', { ascending: false })
      .limit(20);
    setManualNotes(data || []);
  };

  const handleSaveManual = async () => {
    if (!manualText.trim() || !user) return;
    setSaving(true);
    try {
      await (supabase as any).from('contact_messages').insert({
        user_id: user.id,
        contact_id: contact.id,
        source: 'manual',
        content: manualText.trim(),
        sender: 'Nota manual',
        direction: 'incoming',
        message_date: new Date().toISOString(),
        chat_name: manualTitle.trim() || `Nota - ${contact.name}`,
      });
      toast.success('Nota guardada');
      setShowManualDialog(false);
      setManualText('');
      setManualTitle('');
      fetchManualNotes();
    } catch {
      toast.error('Error al guardar nota');
    } finally {
      setSaving(false);
    }
  };

  const getSpeakerNames = (speakers: unknown): string[] => {
    if (!Array.isArray(speakers)) return [];
    return speakers
      .map((s: unknown) => {
        if (typeof s === 'object' && s !== null) {
          const sp = s as Record<string, unknown>;
          return (sp.nombre_detectado || sp.id_original || null) as string | null;
        }
        return null;
      })
      .filter((n): n is string => !!n);
  };

  const getBrainColor = (brain: string | null) => {
    switch (brain) {
      case 'profesional': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'personal':    return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
      case 'familiar':    return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:            return 'bg-muted/10 text-muted-foreground border-muted/30';
    }
  };

  const getBrainIcon = (brain: string | null) => {
    switch (brain) {
      case 'profesional': return <Briefcase className="w-3.5 h-3.5" />;
      case 'familiar':    return <Users className="w-3.5 h-3.5" />;
      default:            return <Globe className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Add manual note button */}
      <Button size="sm" variant="outline" onClick={() => setShowManualDialog(true)} className="w-full">
        <Plus className="w-4 h-4 mr-1.5" /> Añadir nota de conversación
      </Button>

      {/* Plaud recordings */}
      {contactRecordings.length > 0 ? (
        contactRecordings.map(rec => {
          const thread = contactThreads.find(t => (t.recording_ids || []).includes(rec.id));
          const speakers = getSpeakerNames(thread?.speakers);
          return (
            <Card key={rec.id} className="border-border bg-card">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{rec.title || 'Sin título'}</p>
                  {rec.agent_type && (
                    <Badge variant="outline" className={`text-xs flex-shrink-0 flex items-center gap-1 ${getBrainColor(rec.agent_type)}`}>
                      {getBrainIcon(rec.agent_type)}
                      {rec.agent_type}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {rec.received_at ? format(new Date(rec.received_at), "d MMM yyyy", { locale: es }) : '—'}
                </p>
                {speakers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {speakers.map((n, i) => (
                      <span key={i} className={`text-xs px-1.5 py-0.5 rounded-full border ${
                        n.toLowerCase().includes(contact.name.toLowerCase().split(' ')[0])
                          ? "bg-primary/15 text-primary border-primary/30 font-medium"
                          : "bg-muted/10 text-muted-foreground border-border"
                      }`}>
                        <User className="w-3 h-3 inline mr-0.5" />{n}
                      </span>
                    ))}
                  </div>
                )}
                {rec.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{rec.summary}</p>
                )}
              </CardContent>
            </Card>
          );
        })
      ) : null}

      {/* Manual notes */}
      {manualNotes.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground font-mono mt-2">NOTAS MANUALES</p>
          {manualNotes.map((note: any) => (
            <Card key={note.id} className="border-border bg-card">
              <CardContent className="p-3 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {note.created_at ? format(new Date(note.created_at), "d MMM yyyy HH:mm", { locale: es }) : '—'}
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">{note.content}</p>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {contactRecordings.length === 0 && manualNotes.length === 0 && (
        <div className="py-6 text-center space-y-2">
          <Mic className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Sin grabaciones ni notas</p>
        </div>
      )}

      {/* Manual note dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir nota de conversación</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Título (opcional)</Label>
              <Input
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                placeholder="Ej: Reunión café, Llamada telefónica..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contenido de la conversación</Label>
              <Textarea
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                placeholder="Pega o escribe el contenido de la conversación..."
                className="min-h-[150px] text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveManual} disabled={saving || !manualText.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Profile Tab (Enhanced with known data) ────────────────────────────────────

export function ProfileKnownData({ contact }: { contact: Contact }) {
  const { user } = useAuth();
  const [msgStats, setMsgStats] = useState<{ total: number; sources: string[] } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchMsgStats = async () => {
      const { count } = await (supabase as any)
        .from('contact_messages')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', contact.id);

      const { data: sourceData } = await (supabase as any)
        .from('contact_messages')
        .select('source')
        .eq('contact_id', contact.id)
        .limit(1000);

      const sources = [...new Set(sourceData?.map((m: any) => m.source) || [])] as string[];
      if (count && count > 0) {
        setMsgStats({ total: count, sources });
      }
    };
    fetchMsgStats();
  }, [contact.id, user]);

  const hasData = contact.company || contact.role || contact.email || contact.context ||
    contact.relationship || contact.phone_numbers?.length || contact.ai_tags?.length ||
    contact.wa_message_count || contact.last_contact || contact.scores || msgStats ||
    (contact.metadata && Object.keys(contact.metadata as any).length > 0);

  if (!hasData) return null;

  const meta = contact.metadata as any;
  const scores = contact.scores as any;

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground font-mono mb-1">DATOS CONOCIDOS</p>
        <div className="space-y-1.5 text-xs">
          {contact.company && (
            <div className="flex items-center gap-2">
              <Briefcase className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Empresa:</span>
              <span className="text-foreground font-medium">{contact.company}</span>
            </div>
          )}
          {contact.role && (
            <div className="flex items-center gap-2">
              <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Rol:</span>
              <span className="text-foreground font-medium">{contact.role}</span>
            </div>
          )}
          {contact.relationship && (
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Relación:</span>
              <span className="text-foreground font-medium">{contact.relationship}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Email:</span>
              <span className="text-foreground font-medium">{contact.email}</span>
            </div>
          )}
          {contact.phone_numbers && contact.phone_numbers.length > 0 && (
            <div className="flex items-center gap-2">
              <MessageCircle className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Tel:</span>
              <span className="text-foreground">{contact.phone_numbers.join(', ')}</span>
            </div>
          )}
          {/* Message stats */}
          {(msgStats || contact.wa_message_count) && (
            <div className="flex items-center gap-2">
              <MessageCircle className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Mensajes:</span>
              <span className="text-foreground font-medium">
                {msgStats ? `${msgStats.total} (${msgStats.sources.join(', ')})` : `${contact.wa_message_count} (WA)`}
              </span>
            </div>
          )}
          {contact.last_contact && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Último contacto:</span>
              <span className="text-foreground">{format(new Date(contact.last_contact), "d MMM yyyy", { locale: es })}</span>
            </div>
          )}
          {contact.sentiment && (
            <div className="flex items-center gap-2">
              <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Sentimiento:</span>
              <span className="text-foreground font-medium">{contact.sentiment}</span>
            </div>
          )}
          {/* AI tags */}
          {contact.ai_tags && contact.ai_tags.length > 0 && (
            <div className="flex items-start gap-2">
              <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">Tags IA:</span>
              <div className="flex flex-wrap gap-1">
                {contact.ai_tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
          {/* Scores */}
          {scores && typeof scores === 'object' && Object.keys(scores).length > 0 && (
            <div className="flex items-start gap-2">
              <Briefcase className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">Scores:</span>
              <span className="text-foreground">
                {Object.entries(scores).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </span>
            </div>
          )}
          {meta?.emails && Array.isArray(meta.emails) && meta.emails.length > 1 && (
            <div className="flex items-start gap-2">
              <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">Emails:</span>
              <span className="text-foreground">{meta.emails.join(', ')}</span>
            </div>
          )}
          {contact.context && (
            <div className="flex items-start gap-2">
              <MessageCircle className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">Contexto WA:</span>
              <span className="text-foreground">{String(contact.context)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
