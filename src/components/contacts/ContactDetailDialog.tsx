import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, User, Baby, Save, MessageSquare, Calendar, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const BRAIN_OPTIONS = [
  { value: "professional", label: "Profesional", icon: Briefcase },
  { value: "personal", label: "Personal", icon: User },
  { value: "bosco", label: "Familiar", icon: Baby },
];

interface ContactDetailDialogProps {
  contact: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetailDialog({ contact, open, onOpenChange }: ContactDetailDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    company: "",
    role: "",
    relationship: "",
    brain: "",
    email: "",
  });

  // Initialize form when contact changes
  const initForm = (c: any) => ({
    company: c?.company || "",
    role: c?.role || "",
    relationship: c?.relationship || "",
    brain: c?.brain || "personal",
    email: c?.email || "",
  });

  // Reset form when dialog opens with new contact
  const handleOpenChange = (v: boolean) => {
    if (!v) setEditing(false);
    onOpenChange(v);
  };

  // Fetch conversation threads for this contact
  const { data: threads = [] } = useQuery({
    queryKey: ["contact-threads", contact?.name],
    queryFn: async () => {
      if (!contact?.name) return [];
      const { data, error } = await supabase
        .from("conversation_embeddings")
        .select("id, date, brain, summary, people, transcription_id")
        .contains("people", [contact.name])
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!contact?.name && open,
  });

  const unlinkThread = useMutation({
    mutationFn: async (threadId: string) => {
      // 1. Get current people
      const { data: row, error: fetchErr } = await supabase
        .from("conversation_embeddings")
        .select("people")
        .eq("id", threadId)
        .single();
      if (fetchErr || !row) throw fetchErr || new Error("No encontrado");

      // 2. Filter out contact name
      const newPeople = (row.people || []).filter((p: string) => p !== contact.name);

      // 3. Update conversation_embeddings
      const { error: updateErr } = await supabase
        .from("conversation_embeddings")
        .update({ people: newPeople })
        .eq("id", threadId);
      if (updateErr) throw updateErr;

      // 4. Decrement interaction_count
      const { error: countErr } = await supabase
        .from("people_contacts")
        .update({ interaction_count: Math.max(0, (contact.interaction_count || 1) - 1) })
        .eq("id", contact.id);
      if (countErr) throw countErr;
    },
    onSuccess: () => {
      toast.success("Hilo desvinculado");
      queryClient.invalidateQueries({ queryKey: ["contact-threads", contact?.name] });
      queryClient.invalidateQueries({ queryKey: ["people-contacts"] });
    },
    onError: () => toast.error("Error al desvincular"),
  });

  const handleEdit = () => {
    setForm(initForm(contact));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!contact?.id) return;
    const { error } = await supabase
      .from("people_contacts")
      .update({
        company: form.company || null,
        role: form.role || null,
        relationship: form.relationship || null,
        brain: form.brain,
        email: form.email || null,
      })
      .eq("id", contact.id);

    if (error) {
      toast.error("Error al guardar");
      return;
    }
    toast.success("Contacto actualizado");
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ["people-contacts"] });
  };

  if (!contact) return null;

  const brainInfo = BRAIN_OPTIONS.find(b => b.value === contact.brain) || BRAIN_OPTIONS[1];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-primary">
                {contact.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">{contact.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs">
                  <brainInfo.icon className="w-3 h-3 mr-1" />
                  {brainInfo.label}
                </Badge>
                {contact.relationship && (
                  <Badge variant="secondary" className="text-xs">{contact.relationship}</Badge>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Edit form */}
          {editing ? (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Empresa</Label>
                  <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Empresa" className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Rol</Label>
                  <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Rol / Cargo" className="h-9" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Relación</Label>
                  <Input value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} placeholder="Cliente, amigo..." className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Cerebro</Label>
                  <Select value={form.brain} onValueChange={v => setForm(f => ({ ...f, brain: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BRAIN_OPTIONS.map(b => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@ejemplo.com" className="h-9" type="email" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSave} className="gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="py-2">
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {contact.company && <span>🏢 {contact.company}</span>}
                {contact.role && <span>💼 {contact.role}</span>}
                {contact.email && <span>✉️ {contact.email}</span>}
              </div>
              {contact.context && (
                <p className="text-sm text-muted-foreground mt-2">{contact.context}</p>
              )}
              {contact.ai_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {contact.ai_tags.map((tag: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={handleEdit} className="mt-3">
                Editar datos
              </Button>
            </div>
          )}

          <Separator className="my-4" />

          {/* Conversation threads */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-primary" />
              Hilos detectados ({threads.length})
            </h3>
            {threads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No se encontraron conversaciones con este contacto
              </p>
            ) : (
              <div className="space-y-2">
                {threads.map((thread: any) => (
                  <div key={thread.id} className="p-3 rounded-lg border border-border hover:border-primary/20 transition-colors relative group">
                    <button
                      onClick={(e) => { e.stopPropagation(); unlinkThread.mutate(thread.id); }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Desvincular hilo"
                      disabled={unlinkThread.isPending}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(thread.date), "d MMM yyyy", { locale: es })}
                      </span>
                      {thread.brain && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {thread.brain === "professional" ? "Prof" : thread.brain === "personal" ? "Pers" : "Fam"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2">{thread.summary}</p>
                    {thread.people?.length > 1 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {thread.people.filter((p: string) => p !== contact.name).map((p: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{p}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}