import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Mail, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { prepareOAuthWindow, redirectToOAuthUrl } from "@/lib/oauth";

interface EmailAccount {
  id: string;
  provider: string;
  email_address: string;
  display_name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
  credentials_encrypted: Record<string, unknown> | null;
}

export const EmailAccountsSettingsCard = () => {
  const { user, session } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [provider, setProvider] = useState<string>("");
  const [emailAddress, setEmailAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");

  // Detect Google connection
  const hasGoogleOAuth = !!(
    session?.provider_token ||
    (typeof window !== "undefined" && localStorage.getItem("google_provider_token"))
  );

  useEffect(() => {
    if (user) fetchAccounts();
  }, [user]);

  // Handle gmail_connected / gmail_error / outlook_connected / outlook_error query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected")) {
      toast.success("Gmail conectado correctamente via OAuth");
      window.history.replaceState({}, "", window.location.pathname);
      if (user) fetchAccounts();
    }
    if (params.get("gmail_error")) {
      toast.error(`Error Gmail: ${params.get("gmail_error")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("outlook_connected")) {
      toast.success("Outlook conectado correctamente via OAuth");
      window.history.replaceState({}, "", window.location.pathname);
      if (user) fetchAccounts();
    }
    if (params.get("outlook_error")) {
      toast.error(`Error Outlook: ${params.get("outlook_error")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const fetchAccounts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("email_accounts")
      .select("id, provider, email_address, display_name, is_active, last_sync_at, sync_error, credentials_encrypted")
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

  const handleAddGmailAutoConnect = async () => {
    if (!user || !session?.user?.email) return;
    setSaving(true);

    try {
      // Check if already added
      const existing = accounts.find(a => a.provider === "gmail" && a.email_address === session.user.email);
      if (existing) {
        toast.info("Gmail ya está conectado");
        setSaving(false);
        return;
      }

      const providerToken = session.provider_token || localStorage.getItem("google_provider_token") || "";
      const refreshToken = session.provider_refresh_token || localStorage.getItem("google_provider_refresh_token") || "";

      const { error } = await supabase.from("email_accounts").insert({
        user_id: user.id,
        provider: "gmail",
        email_address: session.user.email,
        display_name: "Gmail",
        credentials_encrypted: {
          access_token: providerToken,
          provider_refresh_token: refreshToken,
        },
        is_active: true,
      } as any);

      if (error) throw error;
      toast.success("Gmail conectado automáticamente");
      fetchAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(`Error: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddICloudAutoConnect = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Check user_integrations for existing iCloud credentials
      const { data: integration } = await supabase
        .from("user_integrations")
        .select("icloud_email, icloud_password_encrypted")
        .eq("user_id", user.id)
        .single();

      if (!integration?.icloud_email) {
        toast.error("No tienes iCloud Calendar configurado. Añade la cuenta manualmente con tu contraseña de app.");
        setSaving(false);
        return;
      }

      // Check if already added
      const existing = accounts.find(a => a.provider === "icloud" && a.email_address === integration.icloud_email);
      if (existing) {
        toast.info("iCloud Mail ya está conectado");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("email_accounts").insert({
        user_id: user.id,
        provider: "icloud",
        email_address: integration.icloud_email,
        display_name: "iCloud Mail",
        credentials_encrypted: {
          password: integration.icloud_password_encrypted,
        },
        imap_host: "imap.mail.me.com",
        imap_port: 993,
        is_active: true,
      } as any);

      if (error) throw error;
      toast.success("iCloud Mail conectado (reutilizando credenciales de Calendar)");
      fetchAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(`Error: ${msg}`);
    } finally {
      setSaving(false);
    }
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
      } else if (provider === "imap") {
        if (!appPassword || !imapHost) {
          toast.error("Introduce servidor IMAP y contraseña");
          setSaving(false);
          return;
        }
        credentials.password = appPassword;
      } else if (provider === "gmail") {
        if (appPassword) {
          credentials.password = appPassword;
        } else {
          credentials.note = "Requires Google OAuth token";
        }
      } else if (provider === "outlook") {
        if (!appPassword) {
          toast.error("Introduce la contraseña de aplicación de Microsoft");
          setSaving(false);
          return;
        }
        credentials.password = appPassword;
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
      } else if (provider === "outlook") {
        insertData.imap_host = "outlook.office365.com";
        insertData.imap_port = 993;
      } else if (provider === "gmail" && appPassword) {
        insertData.imap_host = "imap.gmail.com";
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
      const account = accounts.find(a => a.id === accountId);
      const bodyData: Record<string, unknown> = { 
        user_id: user?.id, 
        account_id: accountId, 
        action: "sync" 
      };

      // For Gmail, pass the current provider token
      if (account?.provider === "gmail") {
        const providerToken = session?.provider_token || localStorage.getItem("google_provider_token") || "";
        const refreshToken = session?.provider_refresh_token || localStorage.getItem("google_provider_refresh_token") || "";
        if (providerToken) bodyData.provider_token = providerToken;
        if (refreshToken) bodyData.provider_refresh_token = refreshToken;
      }

      const { data, error } = await supabase.functions.invoke("email-sync", {
        body: bodyData,
      });
      if (error) throw error;
      const synced = data?.results?.[0]?.synced || 0;
      const syncError = data?.results?.[0]?.error;
      if (syncError) {
        toast.error(`Error: ${syncError}`);
      } else {
        toast.success(`${synced} email(s) sincronizados`);
      }
      fetchAccounts();
    } catch {
      toast.error("Error al sincronizar");
    } finally {
      setSyncing(null);
    }
  };

  const handleConnectGmail = async (account: EmailAccount) => {
    setConnecting(account.id);
    try {
      const popup = prepareOAuthWindow();
      const { data, error } = await supabase.functions.invoke("google-email-oauth", {
        body: {
          action: "start",
          account_id: account.id,
          origin: window.location.origin,
          login_hint: account.email_address,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No auth URL returned");
      redirectToOAuthUrl(data.url, popup);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(`Error iniciando OAuth: ${msg}`);
    } finally {
      setConnecting(null);
    }
  };

  const accountNeedsOAuth = (account: EmailAccount): boolean => {
    if (account.provider !== "gmail") return false;
    if (!account.credentials_encrypted) return true;
    const creds = account.credentials_encrypted as Record<string, unknown>;
    // If has password (IMAP mode), no OAuth needed
    if (creds.password) return false;
    return !creds.access_token && !creds.refresh_token;
  };

  const handleConnectOutlook = async (account: EmailAccount) => {
    setConnecting(account.id);
    try {
      const popup = prepareOAuthWindow();
      const { data, error } = await supabase.functions.invoke("microsoft-email-oauth", {
        body: {
          action: "start",
          account_id: account.id,
          origin: window.location.origin,
          login_hint: account.email_address,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No auth URL returned");
      redirectToOAuthUrl(data.url, popup);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(`Error iniciando OAuth de Microsoft: ${msg}`);
    } finally {
      setConnecting(null);
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

  const hasGmailAccount = accounts.some(a => a.provider === "gmail");
  const hasICloudAccount = accounts.some(a => a.provider === "icloud");

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
        {/* Quick-connect buttons */}
        {(!hasGmailAccount && hasGoogleOAuth) && (
          <Button
            variant="outline"
            className="w-full justify-start gap-3 border-dashed"
            onClick={handleAddGmailAutoConnect}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
            <span>Conectar Gmail automáticamente</span>
            <Badge variant="secondary" className="ml-auto text-xs">OAuth detectado</Badge>
          </Button>
        )}

        {!hasICloudAccount && (
          <Button
            variant="outline"
            className="w-full justify-start gap-3 border-dashed"
            onClick={handleAddICloudAutoConnect}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-sky-500" />}
            <span>Conectar iCloud Mail (reutilizar Calendar)</span>
            <Badge variant="secondary" className="ml-auto text-xs">Credenciales existentes</Badge>
          </Button>
        )}

        {/* Existing accounts */}
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
                  {accountNeedsOAuth(account) && (
                    <Badge variant="destructive" className="text-xs">Sin tokens</Badge>
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
              {accountNeedsOAuth(account) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => account.provider === "outlook" ? handleConnectOutlook(account) : handleConnectGmail(account)}
                  disabled={connecting === account.id}
                >
                  {connecting === account.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Link2 className="h-3 w-3" />
                  )}
                  Conectar
                </Button>
              )}
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
              Añadir cuenta manualmente
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

              {(provider === "icloud" || provider === "imap" || provider === "outlook" || provider === "gmail") && (
                <div className="space-y-2">
                  <Label>
                    {provider === "icloud"
                      ? "Contraseña de aplicación (Apple)"
                      : provider === "outlook"
                      ? "Contraseña de aplicación (Microsoft)"
                      : provider === "gmail"
                      ? "Contraseña de aplicación (Google)"
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
                  {provider === "outlook" && (
                    <p className="text-xs text-muted-foreground">
                      Crea una contraseña de aplicación en{" "}
                      <a
                        href="https://account.live.com/proofs/manage/additional"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary"
                      >
                        account.live.com
                      </a>
                      {" "}(requiere verificación en dos pasos activa)
                    </p>
                  )}
                  {provider === "gmail" && (
                    <p className="text-xs text-muted-foreground">
                      Crea una contraseña de aplicación en{" "}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary"
                      >
                        myaccount.google.com/apppasswords
                      </a>
                      {" "}(requiere verificación en dos pasos activa)
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

              {provider === "gmail" && !appPassword && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  Si no introduces contraseña de aplicación, Gmail se conectará vía OAuth. Puedes usar cualquiera de los dos métodos.
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
