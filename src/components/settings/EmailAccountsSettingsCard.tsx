import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Mail, Plus, Trash2, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface EmailAccount {
  id: string;
  provider: string;
  email_address: string;
  display_name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
}

export const EmailAccountsSettingsCard = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [provider, setProvider] = useState<string>("");
  const [emailAddress, setEmailAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");

  useEffect(() => {
    if (user) fetchAccounts();
  }, [user]);

  const fetchAccounts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("email_accounts")
      .select("id, provider, email_address, display_name, is_active, last_sync_at, sync_error")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setAccounts((data as EmailAccount[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setProvider("");
    setEmailAddress("");
    setDisplayName("");
    setAppPassword("");
    setImapHost("");
    setImapPort("993");
  };

  const handleAdd = async () => {
    if (!user || !provider || !emailAddress) return;
    setSaving(true);

    try {
      const credentials: Record<string, string> = {};

      if (provider === "icloud") {
        if (!appPassword) {
          toast.error("Introduce la contraseña de aplicación de Apple");
          setSaving(false);
          return;
        }
        credentials.password = appPassword;
        credentials.imap_host = "imap.mail.me.com";
      } else if (provider === "imap") {
        if (!appPassword || !imapHost) {
          toast.error("Introduce servidor IMAP y contraseña");
          setSaving(false);
          return;
        }
        credentials.password = appPassword;
      } else if (provider === "gmail") {
        // Gmail uses OAuth - for now we store a placeholder, user needs to connect via OAuth
        credentials.note = "Requires Google OAuth token";
      } else if (provider === "outlook") {
        credentials.note = "Requires Microsoft OAuth token";
      }

      const insertData: Record<string, unknown> = {
        user_id: user.id,
        provider,
        email_address: emailAddress,
        display_name: displayName || null,
        credentials_encrypted: credentials,
        is_active: true,
      };

      if (provider === "imap") {
        insertData.imap_host = imapHost;
        insertData.imap_port = parseInt(imapPort) || 993;
      } else if (provider === "icloud") {
        insertData.imap_host = "imap.mail.me.com";
        insertData.imap_port = 993;
      }

      const { error } = await supabase.from("email_accounts").insert(insertData as any);
      if (error) throw error;

      toast.success("Cuenta de correo añadida");
      setDialogOpen(false);
      resetForm();
      fetchAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(`Error: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("email_accounts").delete().eq("id", id);
    if (error) {
      toast.error("Error eliminando cuenta");
      return;
    }
    setAccounts(accounts.filter((a) => a.id !== id));
    toast.success("Cuenta eliminada");
  };

  const handleSync = async (accountId: string) => {
    setSyncing(accountId);
    try {
      const { data, error } = await supabase.functions.invoke("email-sync", {
        body: { user_id: user?.id, account_id: accountId, action: "sync" },
      });
      if (error) throw error;
      const synced = data?.results?.[0]?.synced || 0;
      toast.success(`${synced} email(s) sincronizados`);
      fetchAccounts();
    } catch {
      toast.error("Error al sincronizar");
    } finally {
      setSyncing(null);
    }
  };

  const providerLabels: Record<string, string> = {
    gmail: "Gmail",
    outlook: "Outlook",
    icloud: "iCloud",
    imap: "IMAP",
  };

  const providerColors: Record<string, string> = {
    gmail: "text-red-500",
    outlook: "text-blue-600",
    icloud: "text-sky-500",
    imap: "text-muted-foreground",
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Cuentas de correo
        </CardTitle>
        <CardDescription>
          Conecta tus cuentas de correo para sincronizar emails con JARVIS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between p-3 rounded-lg border border-border"
          >
            <div className="flex items-center gap-3">
              <Mail className={`h-5 w-5 ${providerColors[account.provider] || "text-primary"}`} />
              <div>
                <p className="font-medium text-foreground text-sm">
                  {account.display_name || account.email_address}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {providerLabels[account.provider] || account.provider}
                  </Badge>
                  {account.sync_error && (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      Error
                    </span>
                  )}
                  {account.last_sync_at && !account.sync_error && (
                    <span className="text-xs text-muted-foreground">
                      Último sync: {new Date(account.last_sync_at).toLocaleString("es")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSync(account.id)}
                disabled={syncing === account.id}
              >
                {syncing === account.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(account.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Añadir cuenta de correo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir cuenta de correo</DialogTitle>
              <DialogDescription>
                Conecta una nueva cuenta para sincronizar tus emails
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail</SelectItem>
                    <SelectItem value="outlook">Outlook</SelectItem>
                    <SelectItem value="icloud">iCloud Mail</SelectItem>
                    <SelectItem value="imap">IMAP genérico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Nombre (opcional)</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Mi correo personal"
                />
              </div>

              {(provider === "icloud" || provider === "imap") && (
                <div className="space-y-2">
                  <Label>
                    {provider === "icloud"
                      ? "Contraseña de aplicación (Apple)"
                      : "Contraseña / App password"}
                  </Label>
                  <Input
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                  />
                  {provider === "icloud" && (
                    <p className="text-xs text-muted-foreground">
                      Genera una contraseña de app en{" "}
                      <a
                        href="https://appleid.apple.com/account/manage"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary"
                      >
                        appleid.apple.com
                      </a>
                    </p>
                  )}
                </div>
              )}

              {provider === "imap" && (
                <>
                  <div className="space-y-2">
                    <Label>Servidor IMAP</Label>
                    <Input
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                      placeholder="imap.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Puerto</Label>
                    <Input
                      type="number"
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                      placeholder="993"
                    />
                  </div>
                </>
              )}

              {(provider === "gmail" || provider === "outlook") && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  {provider === "gmail"
                    ? "Gmail se conectará vía OAuth. Si ya tienes Google Calendar conectado, tus credenciales de Google se reutilizarán automáticamente."
                    : "Outlook se conectará vía OAuth de Microsoft. Necesitarás autorizar el acceso a tu correo."}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={saving || !provider || !emailAddress}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Añadir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
