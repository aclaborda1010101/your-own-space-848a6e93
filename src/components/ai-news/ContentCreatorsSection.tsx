import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Youtube, Users } from "lucide-react";

interface Creator {
  name: string;
  channel: string;
  url: string;
  subscribers?: string;
  description?: string;
}

const SPANISH_CREATORS: Creator[] = [
  {
    name: "DotCSV (Carlos Santana)",
    channel: "@DotCSV",
    url: "https://youtube.com/@DotCSV",
    subscribers: "900K+",
    description: "#1 IA en español",
  },
  {
    name: "Xavier Mitjana",
    channel: "@xaviermitjana",
    url: "https://youtube.com/@xaviermitjana",
    description: "IA práctica y negocios",
  },
  {
    name: "Machinelearnear",
    channel: "@machinelearnear",
    url: "https://youtube.com/@machinelearnear",
    description: "ML en español",
  },
  {
    name: "MiguelBaenaIA",
    channel: "@miguelbaenaia",
    url: "https://twitter.com/miguelbaenaia",
    description: "Automatizaciones IA",
  },
  {
    name: "Henry Jiménez",
    channel: "@henryjimenez",
    url: "https://youtube.com/@henryjimenez",
    description: "Formación IA",
  },
  {
    name: "Sergio Señor",
    channel: "@iasergiosenor",
    url: "https://youtube.com/@iasergiosenor",
    description: "IA aplicada",
  },
  {
    name: "NextGen IA Hub",
    channel: "@NextGen_IA_YT",
    url: "https://youtube.com/@NextGen_IA_YT",
    description: "Comunidad IA",
  },
];

const INTERNATIONAL_CREATORS: Creator[] = [
  {
    name: "Matt Wolfe",
    channel: "@maboroshi",
    url: "https://youtube.com/@maboroshi",
    subscribers: "800K+",
    description: "Future Tools",
  },
  {
    name: "AI Explained",
    channel: "@aiexplained-official",
    url: "https://youtube.com/@aiexplained-official",
    subscribers: "500K+",
    description: "Deep dives técnicos",
  },
  {
    name: "Two Minute Papers",
    channel: "@TwoMinutePapers",
    url: "https://youtube.com/@TwoMinutePapers",
    subscribers: "1.5M+",
    description: "Papers de IA explicados",
  },
  {
    name: "Fireship",
    channel: "@Fireship",
    url: "https://youtube.com/@Fireship",
    subscribers: "3M+",
    description: "Tech + IA rápido",
  },
];

const CreatorCard = ({ creator }: { creator: Creator }) => (
  <a
    href={creator.url}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all group"
  >
    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
      <Youtube className="w-5 h-5 text-destructive" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors">
        {creator.name}
      </p>
      <p className="text-xs text-muted-foreground truncate">
        {creator.description}
      </p>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {creator.subscribers && (
        <Badge variant="outline" className="text-xs">
          {creator.subscribers}
        </Badge>
      )}
      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </div>
  </a>
);

export const ContentCreatorsSection = () => {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Creadores de Contenido IA
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Los mejores divulgadores de Inteligencia Artificial
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Spanish Creators */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            🇪🇸 Español
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {SPANISH_CREATORS.map((creator) => (
              <CreatorCard key={creator.name} creator={creator} />
            ))}
          </div>
        </div>

        {/* International Creators */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            🌍 Internacional
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {INTERNATIONAL_CREATORS.map((creator) => (
              <CreatorCard key={creator.name} creator={creator} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
