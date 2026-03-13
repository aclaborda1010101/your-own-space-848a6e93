import { MicOff, Wrench, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Communications() {
  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
      <Card className="w-full border-primary/20 bg-primary/5">
        <CardHeader className="space-y-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/30">
            <MicOff className="w-7 h-7 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Realtime voice retirada temporalmente</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">
              La capa anterior de voz y comunicaciones en tiempo real se ha desactivado para reconstruirla bien sobre una base más simple.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-border/50 bg-background/60 p-4 text-sm text-muted-foreground">
            La siguiente versión se volverá a activar cuando el núcleo de POTUS por texto esté estable y validado.
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/dashboard">
                Volver al dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" />
            Estado actual: voice/realtime visible desactivado, reconstrucción pendiente.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
