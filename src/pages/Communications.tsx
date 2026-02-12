import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Mail, MessageCircle, RefreshCw, Loader2, Inbox, User
} from "lucide-react";
import { toast } from "sonner";

interface EmailCache {
  id: string; account: string; from_addr: string; subject: string; preview?: string; synced_at: string; is_read: boolean;
}
interface WhatsAppCache {
  id: string; chat_name: string; last_message: string; last_time: string; is_read: boolean;
}

const Communications = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("email");
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<EmailCache[]>([]);
  const [whatsappChats, setWhatsappChats] = useState<WhatsAppCache[]>([]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [emailsRes, whatsappRes] = await Promise.all([
        supabase.from('jarvis_emails_cache').select('*').order('synced_at', { ascending: false }),
        supabase.from('jarvis_whatsapp_cache').select('*').order('last_time', { ascending: false })
      ]);
      if (emailsRes.data) setEmails(emailsRes.data);
      if (whatsappRes.data) setWhatsappChats(whatsappRes.data);
    } catch (error) {
      console.error('Error fetching communications:', error);
      toast.error('Error al cargar comunicaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await supabase.functions.invoke('email-sync', { body: { user_id: user?.id, action: 'sync' } });
    } catch (e) { console.error('Email sync error:', e); }
    await fetchData();
    toast.success('Comunicaciones actualizadas');
  };

  const emailsByAccount = emails.reduce((acc, email) => {
    if (!acc[email.account]) acc[email.account] = [];
    acc[email.account].push(email);
    return acc;
  }, {} as Record<string, EmailCache[]>);

  const unreadEmails = emails.filter(e => !e.is_read).length;
  const unreadWhatsapp = whatsappChats.filter(c => !c.is_read).length;

  const formatTime = (dateStr: string) => {
    try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es }); }
    catch { return dateStr; }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
            <Mail className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Comunicaciones</h1>
            <p className="text-sm text-muted-foreground font-mono">{unreadEmails + unreadWhatsapp} MENSAJES SIN LEER</p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{emails.length}</p>
              <p className="text-xs text-muted-foreground">Emails ({unreadEmails} sin leer)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{whatsappChats.length}</p>
              <p className="text-xs text-muted-foreground">WhatsApp ({unreadWhatsapp} sin leer)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="email" className="gap-2">
            <Mail className="w-4 h-4" />Email
            {unreadEmails > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5">{unreadEmails}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="w-4 h-4" />WhatsApp
            {unreadWhatsapp > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5">{unreadWhatsapp}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4 space-y-6">
          {loading && emails.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : Object.keys(emailsByAccount).length > 0 ? (
            Object.entries(emailsByAccount).map(([account, accountEmails]) => (
              <div key={account} className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{account}</h3>
                  <Badge variant="outline" className="text-xs">{accountEmails.length} emails</Badge>
                </div>
                {accountEmails.map((email) => (
                  <Card key={email.id} className={cn("border-border bg-card cursor-pointer transition-all hover:border-primary/30", !email.is_read && "bg-primary/5 border-primary/20")}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-medium truncate", !email.is_read && "font-semibold")}>{email.from_addr}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(email.synced_at)}</span>
                          </div>
                          <p className={cn("text-sm truncate mt-1", !email.is_read ? "text-foreground" : "text-muted-foreground")}>{email.subject}</p>
                          {email.preview && <p className="text-xs text-muted-foreground truncate mt-0.5">{email.preview}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))
          ) : (
            <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
              <CardContent className="p-6 text-center">
                <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No hay emails sincronizados</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4 space-y-3">
          {loading && whatsappChats.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : whatsappChats.length > 0 ? (
            whatsappChats.map((chat) => (
              <Card key={chat.id} className={cn("border-border bg-card cursor-pointer transition-all hover:border-success/30", !chat.is_read && "bg-success/5 border-success/20")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium", !chat.is_read && "font-semibold")}>{chat.chat_name}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(chat.last_time)}</span>
                      </div>
                      <p className={cn("text-sm truncate mt-1", !chat.is_read ? "text-foreground" : "text-muted-foreground")}>{chat.last_message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
              <CardContent className="p-6 text-center">
                <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No hay chats de WhatsApp</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Communications;
