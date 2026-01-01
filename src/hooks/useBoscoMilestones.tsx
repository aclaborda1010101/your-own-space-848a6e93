import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Trophy, Flame, Star, Target, BookOpen, Sparkles } from 'lucide-react';

interface VocabularyStats {
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  totalSessions: number;
  accuracy: number;
  streak: number;
}

interface MilestoneConfig {
  key: string;
  check: (stats: VocabularyStats, prevStats: VocabularyStats | null) => boolean;
  message: string;
  icon: React.ReactNode;
  type: 'success' | 'info';
}

const MILESTONES: MilestoneConfig[] = [
  // Mastered words milestones
  {
    key: 'mastered_5',
    check: (stats, prev) => stats.masteredWords >= 5 && (!prev || prev.masteredWords < 5),
    message: '¡Bosco ha dominado 5 palabras! 🌟',
    icon: <Star className="w-5 h-5 text-yellow-500" />,
    type: 'success'
  },
  {
    key: 'mastered_10',
    check: (stats, prev) => stats.masteredWords >= 10 && (!prev || prev.masteredWords < 10),
    message: '¡Increíble! 10 palabras dominadas 🏆',
    icon: <Trophy className="w-5 h-5 text-yellow-500" />,
    type: 'success'
  },
  {
    key: 'mastered_25',
    check: (stats, prev) => stats.masteredWords >= 25 && (!prev || prev.masteredWords < 25),
    message: '¡Bosco es un campeón! 25 palabras dominadas 🎉',
    icon: <Trophy className="w-5 h-5 text-yellow-500" />,
    type: 'success'
  },
  {
    key: 'mastered_50',
    check: (stats, prev) => stats.masteredWords >= 50 && (!prev || prev.masteredWords < 50),
    message: '¡Impresionante! 50 palabras en inglés dominadas 🚀',
    icon: <Sparkles className="w-5 h-5 text-primary" />,
    type: 'success'
  },
  {
    key: 'mastered_100',
    check: (stats, prev) => stats.masteredWords >= 100 && (!prev || prev.masteredWords < 100),
    message: '¡100 palabras! Bosco es bilingüe 🌍',
    icon: <Sparkles className="w-5 h-5 text-primary" />,
    type: 'success'
  },
  
  // Streak milestones
  {
    key: 'streak_3',
    check: (stats, prev) => stats.streak >= 3 && (!prev || prev.streak < 3),
    message: '¡3 días de racha! Bosco es constante 🔥',
    icon: <Flame className="w-5 h-5 text-orange-500" />,
    type: 'success'
  },
  {
    key: 'streak_7',
    check: (stats, prev) => stats.streak >= 7 && (!prev || prev.streak < 7),
    message: '¡Una semana completa de práctica! 🔥🔥',
    icon: <Flame className="w-5 h-5 text-orange-500" />,
    type: 'success'
  },
  {
    key: 'streak_14',
    check: (stats, prev) => stats.streak >= 14 && (!prev || prev.streak < 14),
    message: '¡2 semanas de racha! Increíble dedicación 🌟',
    icon: <Flame className="w-5 h-5 text-orange-500" />,
    type: 'success'
  },
  {
    key: 'streak_30',
    check: (stats, prev) => stats.streak >= 30 && (!prev || prev.streak < 30),
    message: '¡Un mes completo! Bosco es imparable 🏆',
    icon: <Trophy className="w-5 h-5 text-yellow-500" />,
    type: 'success'
  },
  
  // Total words milestones
  {
    key: 'total_20',
    check: (stats, prev) => stats.totalWords >= 20 && (!prev || prev.totalWords < 20),
    message: '¡20 palabras en el vocabulario de Bosco! 📚',
    icon: <BookOpen className="w-5 h-5 text-blue-500" />,
    type: 'info'
  },
  {
    key: 'total_50',
    check: (stats, prev) => stats.totalWords >= 50 && (!prev || prev.totalWords < 50),
    message: '¡El vocabulario de Bosco crece: 50 palabras! 📖',
    icon: <BookOpen className="w-5 h-5 text-blue-500" />,
    type: 'info'
  },
  
  // Accuracy milestones
  {
    key: 'accuracy_80',
    check: (stats, prev) => stats.accuracy >= 80 && stats.totalSessions >= 5 && (!prev || prev.accuracy < 80),
    message: '¡80% de precisión! Bosco aprende rápido 🎯',
    icon: <Target className="w-5 h-5 text-green-500" />,
    type: 'success'
  },
  {
    key: 'accuracy_90',
    check: (stats, prev) => stats.accuracy >= 90 && stats.totalSessions >= 10 && (!prev || prev.accuracy < 90),
    message: '¡90% de precisión! Memoria de elefante 🧠',
    icon: <Target className="w-5 h-5 text-green-500" />,
    type: 'success'
  },
  
  // Sessions milestones
  {
    key: 'sessions_10',
    check: (stats, prev) => stats.totalSessions >= 10 && (!prev || prev.totalSessions < 10),
    message: '¡10 sesiones de práctica completadas! 💪',
    icon: <Sparkles className="w-5 h-5 text-purple-500" />,
    type: 'info'
  },
  {
    key: 'sessions_25',
    check: (stats, prev) => stats.totalSessions >= 25 && (!prev || prev.totalSessions < 25),
    message: '¡25 sesiones! Bosco es un estudiante dedicado 📝',
    icon: <Sparkles className="w-5 h-5 text-purple-500" />,
    type: 'success'
  },
];

export function useBoscoMilestones(stats: VocabularyStats) {
  const prevStatsRef = useRef<VocabularyStats | null>(null);
  const shownMilestonesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Skip on first render when we don't have previous stats
    if (prevStatsRef.current === null) {
      prevStatsRef.current = stats;
      return;
    }

    // Check each milestone
    for (const milestone of MILESTONES) {
      if (
        milestone.check(stats, prevStatsRef.current) &&
        !shownMilestonesRef.current.has(milestone.key)
      ) {
        shownMilestonesRef.current.add(milestone.key);
        
        toast(milestone.message, {
          icon: milestone.icon,
          duration: 5000,
          className: milestone.type === 'success' 
            ? 'border-success/50 bg-success/5' 
            : 'border-primary/50 bg-primary/5'
        });
      }
    }

    prevStatsRef.current = stats;
  }, [stats]);
}
