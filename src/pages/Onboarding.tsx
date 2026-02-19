import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Smartphone, MessageSquare, Mail, Link, Upload, Loader2,
  Check, X, HelpCircle, ArrowRight, ArrowLeft, SkipForward,
  UserPlus, RefreshCw,
} from "lucide-react";
import { useOnboarding, type OnboardingStep } from "@/hooks/useOnboarding";

const STEPS = [
  { icon: Smartphone, label: "Contactos", emoji: "📱" },
  { icon: MessageSquare, label: "WhatsApp", emoji: "💬" },
  { icon: Mail, label: "Email", emoji: "📧" },
  { icon: Link, label: "Vinculación", emoji: "🔗" },
];

const Stepper = ({ current }: { current: OnboardingStep }) => (
  <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
    {STEPS.map((s, i) => {
      const stepNum = (i + 1) as OnboardingStep;
      const isActive = current === stepNum;
      const isDone = current > stepNum;
      return (
        <div key={i} className="flex items-center gap-1 sm:gap-2">
          {i > 0 && <div className={`h-0.5 w-4 sm:w-8 ${isDone ? 'bg-primary' : 'bg-muted'}`} />}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors ${
            isActive ? 'bg-primary text-primary-foreground' :
            isDone ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {isDone ? <Check className="h-3 w-3" /> : <span>{s.emoji}</span>}
            <span className="hidden sm:inline">{s.label}</span>
          </div>
        </div>
      );
    })}
  </div>
);

// ── Welcome Step ──────────────────────────────────────────────────────────────

const WelcomeStep = ({ onStart }: { onStart: () => void }) => (
  <div className="flex flex-col items-center text-center max-w-lg mx-auto space-y-6">
    <div className="text-5xl sm:text-6xl">🚀</div>
    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">¡Vamos a configurar Jarvis!</h1>
    <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
      Para que tu asistente funcione a pleno rendimiento, necesitamos importar tus datos.
      El proceso tiene 4 pasos y tarda unos 10-15 minutos.
    </p>
    <div className="space-y-3 text-left w-full">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
          <span className="text-xl">{s.emoji}</span>
          <span className="text-sm font-medium text-foreground">Paso {i + 1}: {s.label}</span>
        </div>
      ))}
    </div>
    <Button size="lg" onClick={onStart} className="w-full sm:w-auto">
      Empezar <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  </div>
);

// ── Step 1: Contacts ──────────────────────────────────────────────────────────

const ContactsStep = ({ hook }: { hook: ReturnType<typeof useOnboarding> }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center space-y-2">
        <div className="text-4xl">📱</div>
        <h2 className="text-xl font-bold text-foreground">Importar contactos</h2>
        <p className="text-muted-foreground text-sm">
          Exporta tu agenda de contactos como archivo .vcf (vCard) y súbelo aquí.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            <strong>iPhone:</strong> Ajustes → Contactos → Exportar → Compartir .vcf<br />
            <strong>Android:</strong> Contactos → Menú → Exportar → .vcf
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".vcf,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) hook.importVCF(f);
            }}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={hook.loading}
          >
            {hook.loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Subir archivo .vcf
          </Button>
        </CardContent>
      </Card>

      {hook.contactResult && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="font-medium text-sm text-foreground">
                {hook.contactResult.total} contactos procesados
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-green-500/10">
                <div className="font-bold text-green-500">{hook.contactResult.newCount}</div>
                <div className="text-muted-foreground">Nuevos</div>
              </div>
              <div className="p-2 rounded bg-primary/10">
                <div className="font-bold text-primary">{hook.contactResult.enrichedCount}</div>
                <div className="text-muted-foreground">Enriquecidos</div>
              </div>
              <div className="p-2 rounded bg-muted">
                <div className="font-bold text-muted-foreground">{hook.contactResult.duplicateCount}</div>
                <div className="text-muted-foreground">Duplicados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => hook.setStep(0)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => hook.setStep(2)}>
          <SkipForward className="h-4 w-4 mr-1" /> Saltar
        </Button>
        <Button onClick={() => hook.setStep(2)} disabled={!hook.contactResult}>
          Siguiente <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// ── Step 2: WhatsApp ──────────────────────────────────────────────────────────

const WhatsAppStep = ({ hook }: { hook: ReturnType<typeof useOnboarding> }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center space-y-2">
        <div className="text-4xl">💬</div>
        <h2 className="text-xl font-bold text-foreground">Importar WhatsApp</h2>
        <p className="text-muted-foreground text-sm">
          Exporta tus chats de WhatsApp y súbelos aquí (archivos .txt).
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            WhatsApp → Chat → Menú (⋮) → Más → Exportar chat → Sin archivos
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.zip,.xlsx"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) hook.importWhatsApp(files);
            }}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={hook.loading}
          >
            {hook.loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Subir archivos de WhatsApp
          </Button>
        </CardContent>
      </Card>

      {hook.whatsappResult && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="font-medium text-sm text-foreground">Importación completada</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-primary/10">
                <div className="font-bold text-primary">{hook.whatsappResult.chatCount}</div>
                <div className="text-muted-foreground">Chats</div>
              </div>
              <div className="p-2 rounded bg-primary/10">
                <div className="font-bold text-primary">{hook.whatsappResult.messageCount}</div>
                <div className="text-muted-foreground">Mensajes</div>
              </div>
              <div className="p-2 rounded bg-green-500/10">
                <div className="font-bold text-green-500">{hook.whatsappResult.linkedCount}</div>
                <div className="text-muted-foreground">Vinculados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => hook.setStep(1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => hook.setStep(3)}>
          <SkipForward className="h-4 w-4 mr-1" /> Saltar
        </Button>
        <Button onClick={() => hook.setStep(3)}>
          Siguiente <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// ── Step 3: Email ─────────────────────────────────────────────────────────────

const EmailStep = ({ hook }: { hook: ReturnType<typeof useOnboarding> }) => {
  useEffect(() => {
    hook.fetchEmailAccounts();
  }, []);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center space-y-2">
        <div className="text-4xl">📧</div>
        <h2 className="text-xl font-bold text-foreground">Cuentas de email</h2>
        <p className="text-muted-foreground text-sm">
          Conecta tus cuentas de email para que Jarvis pueda analizar tu correspondencia.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {hook.emailAccounts.length > 0 ? (
            <div className="space-y-2">
              {hook.emailAccounts.map((acc: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-foreground truncate">{acc.email || acc.account_email || `Cuenta ${i + 1}`}</span>
                  <Badge variant="outline" className="ml-auto text-xs">{acc.provider || 'email'}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay cuentas de email conectadas todavía.
            </p>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={hook.syncEmails}
            disabled={hook.syncing || hook.emailAccounts.length === 0}
          >
            {hook.syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar emails
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => hook.setStep(2)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => hook.setStep(4)}>
          <SkipForward className="h-4 w-4 mr-1" /> Saltar
        </Button>
        <Button onClick={() => hook.setStep(4)}>
          Siguiente <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// ── Step 4: Linking ───────────────────────────────────────────────────────────

const LinkingStep = ({ hook, onComplete }: { hook: ReturnType<typeof useOnboarding>; onComplete: () => void }) => {
  useEffect(() => {
    hook.fetchSuggestions();
  }, []);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center space-y-2">
        <div className="text-4xl">🔗</div>
        <h2 className="text-xl font-bold text-foreground">Vinculación inteligente</h2>
        <p className="text-muted-foreground text-sm">
          Revisa las sugerencias y confirma o descarta cada una.
        </p>
      </div>

      {hook.loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : hook.suggestions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium">¡Todo vinculado!</p>
            <p className="text-xs text-muted-foreground mt-1">
              No hay sugerencias pendientes de vinculación.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground text-center">
            {hook.suggestions.length} sugerencia{hook.suggestions.length !== 1 ? 's' : ''} pendiente{hook.suggestions.length !== 1 ? 's' : ''}
          </p>
          {hook.suggestions.map((s) => (
            <Card key={s.id} className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      "{s.mentioned_name}"
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fuente: {s.mentioned_in_source}
                    </p>
                    {s.suggested_contact_name && (
                      <p className="text-xs text-primary mt-1">
                        → ¿Es "{s.suggested_contact_name}"?
                      </p>
                    )}
                  </div>
                  <Badge variant={s.confidence >= 0.8 ? "default" : "secondary"} className="text-xs flex-shrink-0">
                    {s.confidence >= 0.8 ? '🟢' : s.confidence >= 0.5 ? '🟡' : '🔴'} {Math.round(s.confidence * 100)}%
                  </Badge>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {s.suggested_contact_id && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs"
                      onClick={() => hook.acceptSuggestion(s.id, s.suggested_contact_id!, s.mentioned_name)}
                    >
                      <Check className="h-3 w-3 mr-1" /> Vincular
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() => hook.rejectSuggestion(s.id)}
                  >
                    <X className="h-3 w-3 mr-1" /> No es
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => hook.deferSuggestion(s.id)}
                  >
                    <HelpCircle className="h-3 w-3 mr-1" /> No sé
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => hook.setStep(3)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <div className="flex-1" />
        <Button onClick={onComplete}>
          Completar configuración <Check className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// ── Main Onboarding Page ──────────────────────────────────────────────────────

const Onboarding = () => {
  const navigate = useNavigate();
  const hook = useOnboarding();

  const handleComplete = async () => {
    await hook.completeOnboarding();
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {hook.step > 0 && <Stepper current={hook.step} />}

        {hook.step === 0 && <WelcomeStep onStart={() => hook.setStep(1)} />}
        {hook.step === 1 && <ContactsStep hook={hook} />}
        {hook.step === 2 && <WhatsAppStep hook={hook} />}
        {hook.step === 3 && <EmailStep hook={hook} />}
        {hook.step === 4 && <LinkingStep hook={hook} onComplete={handleComplete} />}
      </div>

      {/* Progress indicator */}
      {hook.step > 0 && (
        <div className="p-4 border-t border-border">
          <Progress value={(hook.step / 4) * 100} className="h-1" />
          <p className="text-xs text-muted-foreground text-center mt-2">
            Paso {hook.step} de 4
          </p>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
