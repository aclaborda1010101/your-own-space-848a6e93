import { useState, useEffect, useCallback } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from "lucide-react";

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

  // ---- WhatsApp Import ----
  const [waFile, setWaFile] = useState<File | null>(null);
  const [waProcessing, setWaProcessing] = useState(false);
  const [waContactMode, setWaContactMode] = useState<"existing" | "new">("existing");
  const [waSelectedContact, setWaSelectedContact] = useState<string>("");
  const [waNewContactName, setWaNewContactName] = useState("");

  const handleWhatsAppImport = async () => {
    if (!waFile || !user) return;

    // Validate contact selection
    const hasContact = waContactMode === "existing" ? !!waSelectedContact : !!waNewContactName.trim();
    if (!hasContact) {
      toast.error("Selecciona o crea un contacto para vincular el chat");
      return;
    }

    setWaProcessing(true);

    try {
      // Resolve contact
      let linkedContactId = "";
      let linkedContactName = "";

      if (waContactMode === "existing") {
        linkedContactId = waSelectedContact;
        linkedContactName = existingContacts.find((c) => c.id === waSelectedContact)?.name || "";
      } else {
        // Create new contact
        const { data: newContact, error: createErr } = await (supabase as any)
          .from("people_contacts")
          .insert({
            user_id: user.id,
            name: waNewContactName.trim(),
            context: "Importado desde WhatsApp",
            brain: "personal",
          })
          .select("id, name")
          .single();

        if (createErr) throw createErr;
        linkedContactId = newContact.id;
        linkedContactName = newContact.name;
        setExistingContacts((prev) => [...prev, { id: newContact.id, name: newContact.name }].sort((a, b) => a.name.localeCompare(b.name)));
      }

      const text = await waFile.text();
      const speakerSet = new Set<string>();
      const lines = text.split("\n");
      let myMessageCount = 0;
      let otherMessageCount = 0;

      // Get my identifiers
      const myIds = profile?.my_identifiers && typeof profile.my_identifiers === 'object' && !Array.isArray(profile.my_identifiers)
        ? profile.my_identifiers as Record<string, unknown>
        : {};
      const myWaNames: string[] = Array.isArray(myIds.whatsapp_names) ? (myIds.whatsapp_names as string[]) : [];
      const myWaNumbers: string[] = Array.isArray(myIds.whatsapp_numbers) ? (myIds.whatsapp_numbers as string[]) : [];
      const myIdentifiers = [...myWaNames, ...myWaNumbers].map(n => n.toLowerCase().trim());

      for (const line of lines) {
        const match = line.match(/(?:\[.*?\]|^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4},?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|a\.\s?m\.|p\.\s?m\.)?)\s*[-–]?\s*([^:]+?):\s/i);
        if (match) {
          const name = match[1].trim();
          if (name && !name.match(/^\+?\d[\d\s]+$/)) {
            if (myIdentifiers.length > 0 && myIdentifiers.includes(name.toLowerCase())) {
              myMessageCount++;
            } else {
              speakerSet.add(name);
              otherMessageCount++;
            }
          }
        }
      }

      const contacts: DetectedContact[] = Array.from(speakerSet).map((name) => ({
        name,
        role: "Contacto WhatsApp",
        confirmed: false,
        editing: false,
      }));

      const summaryParts = [];
      if (myMessageCount > 0) summaryParts.push(`${myMessageCount} mensajes tuyos`);
      if (otherMessageCount > 0) summaryParts.push(`${otherMessageCount} del contacto`);
      summaryParts.push(`${contacts.length} participantes`);
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
      toast.success(`Chat importado y vinculado a "${linkedContactName}"`);
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
      // Simple speaker detection from transcription patterns like "Speaker 1:", "Hablante A:"
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
      // Plaud exports typically have speaker labels
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

    // Remove from contacts list
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
          Importa conversaciones y grabaciones para generar contactos automáticamente
        </p>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="audio" className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Audio
          </TabsTrigger>
          <TabsTrigger value="plaud" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Plaud
          </TabsTrigger>
        </TabsList>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Importar Chat de WhatsApp
              </CardTitle>
              <CardDescription>
                Sube un archivo .txt exportado desde WhatsApp. Se detectarán automáticamente los participantes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact selector */}
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
                  <Select value={waSelectedContact} onValueChange={setWaSelectedContact}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un contacto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingContacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                      {existingContacts.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No hay contactos. Crea uno nuevo.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Nombre del nuevo contacto..."
                    value={waNewContactName}
                    onChange={(e) => setWaNewContactName(e.target.value)}
                  />
                )}
              </div>

              {/* File upload */}
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".txt"
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
                WhatsApp → Chat → Exportar chat → Sin archivos multimedia
              </p>
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
