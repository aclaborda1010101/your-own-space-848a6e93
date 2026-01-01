import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Star, 
  Flame, 
  Target, 
  BookOpen, 
  Sparkles,
  Medal,
  Zap,
  Crown,
  Heart
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VocabularyStats {
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  totalSessions: number;
  accuracy: number;
  streak: number;
}

interface BadgeConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  check: (stats: VocabularyStats) => boolean;
  progress?: (stats: VocabularyStats) => { current: number; target: number };
}

const BADGES: BadgeConfig[] = [
  // Word milestones
  {
    id: 'first_word',
    name: 'Primera Palabra',
    description: 'Añade tu primera palabra',
    icon: Star,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
    check: (s) => s.totalWords >= 1,
    progress: (s) => ({ current: Math.min(s.totalWords, 1), target: 1 })
  },
  {
    id: 'collector_10',
    name: 'Coleccionista',
    description: '10 palabras en vocabulario',
    icon: BookOpen,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
    check: (s) => s.totalWords >= 10,
    progress: (s) => ({ current: Math.min(s.totalWords, 10), target: 10 })
  },
  {
    id: 'scholar_50',
    name: 'Erudito',
    description: '50 palabras en vocabulario',
    icon: BookOpen,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/20',
    check: (s) => s.totalWords >= 50,
    progress: (s) => ({ current: Math.min(s.totalWords, 50), target: 50 })
  },
  {
    id: 'polyglot_100',
    name: 'Políglota',
    description: '100 palabras en vocabulario',
    icon: Crown,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
    check: (s) => s.totalWords >= 100,
    progress: (s) => ({ current: Math.min(s.totalWords, 100), target: 100 })
  },
  
  // Mastery milestones
  {
    id: 'mastered_5',
    name: 'Aprendiz',
    description: '5 palabras dominadas',
    icon: Trophy,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/20',
    check: (s) => s.masteredWords >= 5,
    progress: (s) => ({ current: Math.min(s.masteredWords, 5), target: 5 })
  },
  {
    id: 'mastered_25',
    name: 'Experto',
    description: '25 palabras dominadas',
    icon: Medal,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
    check: (s) => s.masteredWords >= 25,
    progress: (s) => ({ current: Math.min(s.masteredWords, 25), target: 25 })
  },
  {
    id: 'mastered_50',
    name: 'Maestro',
    description: '50 palabras dominadas',
    icon: Crown,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-600/20',
    check: (s) => s.masteredWords >= 50,
    progress: (s) => ({ current: Math.min(s.masteredWords, 50), target: 50 })
  },
  
  // Streak milestones
  {
    id: 'streak_3',
    name: 'Constante',
    description: '3 días de racha',
    icon: Flame,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
    check: (s) => s.streak >= 3,
    progress: (s) => ({ current: Math.min(s.streak, 3), target: 3 })
  },
  {
    id: 'streak_7',
    name: 'Dedicado',
    description: '7 días de racha',
    icon: Flame,
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
    check: (s) => s.streak >= 7,
    progress: (s) => ({ current: Math.min(s.streak, 7), target: 7 })
  },
  {
    id: 'streak_30',
    name: 'Imparable',
    description: '30 días de racha',
    icon: Zap,
    color: 'text-red-600',
    bgColor: 'bg-red-600/20',
    check: (s) => s.streak >= 30,
    progress: (s) => ({ current: Math.min(s.streak, 30), target: 30 })
  },
  
  // Accuracy milestones
  {
    id: 'accuracy_80',
    name: 'Preciso',
    description: '80% de precisión (5+ sesiones)',
    icon: Target,
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
    check: (s) => s.accuracy >= 80 && s.totalSessions >= 5,
    progress: (s) => ({ current: s.totalSessions >= 5 ? Math.min(s.accuracy, 80) : 0, target: 80 })
  },
  {
    id: 'accuracy_95',
    name: 'Perfeccionista',
    description: '95% de precisión (10+ sesiones)',
    icon: Sparkles,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/20',
    check: (s) => s.accuracy >= 95 && s.totalSessions >= 10,
    progress: (s) => ({ current: s.totalSessions >= 10 ? Math.min(s.accuracy, 95) : 0, target: 95 })
  },
  
  // Sessions milestones
  {
    id: 'sessions_10',
    name: 'Practicante',
    description: '10 sesiones completadas',
    icon: Heart,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/20',
    check: (s) => s.totalSessions >= 10,
    progress: (s) => ({ current: Math.min(s.totalSessions, 10), target: 10 })
  },
  {
    id: 'sessions_50',
    name: 'Veterano',
    description: '50 sesiones completadas',
    icon: Star,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/20',
    check: (s) => s.totalSessions >= 50,
    progress: (s) => ({ current: Math.min(s.totalSessions, 50), target: 50 })
  },
];

interface BoscoBadgesProps {
  stats: VocabularyStats;
}

export function BoscoBadges({ stats }: BoscoBadgesProps) {
  const unlockedBadges = BADGES.filter(badge => badge.check(stats));
  const lockedBadges = BADGES.filter(badge => !badge.check(stats));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Insignias de Bosco
          </CardTitle>
          <Badge variant="secondary">
            {unlockedBadges.length} / {BADGES.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unlocked badges */}
        {unlockedBadges.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Desbloqueadas</p>
            <div className="flex flex-wrap gap-2">
              {unlockedBadges.map(badge => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border",
                      badge.bgColor,
                      "border-border/50"
                    )}
                    title={badge.description}
                  >
                    <Icon className={cn("w-4 h-4", badge.color)} />
                    <span className="text-sm font-medium">{badge.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Locked badges */}
        {lockedBadges.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Por desbloquear</p>
            <div className="flex flex-wrap gap-2">
              {lockedBadges.slice(0, 6).map(badge => {
                const Icon = badge.icon;
                const progress = badge.progress?.(stats);
                const progressPct = progress ? (progress.current / progress.target) * 100 : 0;
                
                return (
                  <div
                    key={badge.id}
                    className="relative flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 opacity-60"
                    title={`${badge.description} (${progress?.current || 0}/${progress?.target || 0})`}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-muted-foreground">{badge.name}</span>
                      {progress && (
                        <div className="w-16 h-1 bg-border rounded-full mt-1 overflow-hidden">
                          <div 
                            className="h-full bg-primary/50 rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
