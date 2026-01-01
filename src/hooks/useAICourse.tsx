import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SkillProgress {
  skill_id: string;
  progress: number;
  status: string;
  last_updated: string;
}

interface LessonProgress {
  lesson_id: number;
  completed: boolean;
  completed_at: string | null;
}

interface ProjectProgress {
  project_id: string;
  progress: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

export function useAICourse() {
  const { user } = useAuth();
  const [skills, setSkills] = useState<SkillProgress[]>([]);
  const [lessons, setLessons] = useState<LessonProgress[]>([]);
  const [projects, setProjects] = useState<ProjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [skillsRes, lessonsRes, projectsRes] = await Promise.all([
        supabase
          .from('ai_course_skills')
          .select('skill_id, progress, status, last_updated')
          .eq('user_id', user.id),
        supabase
          .from('ai_course_lessons')
          .select('lesson_id, completed, completed_at')
          .eq('user_id', user.id),
        supabase
          .from('ai_course_projects')
          .select('project_id, progress, status, started_at, completed_at')
          .eq('user_id', user.id),
      ]);

      if (skillsRes.data) setSkills(skillsRes.data);
      if (lessonsRes.data) setLessons(lessonsRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);

      // Calculate streak from recent activity
      const recentActivity = [...(skillsRes.data || []), ...(lessonsRes.data || [])];
      if (recentActivity.length > 0) {
        setStreak(Math.min(recentActivity.length, 30));
      }
    } catch (error) {
      console.error('Error fetching AI course data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateSkillProgress = async (skillId: string, progress: number, status?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('ai_course_skills')
        .upsert({
          user_id: user.id,
          skill_id: skillId,
          progress,
          status: status || (progress >= 100 ? 'completed' : 'in_progress'),
          last_updated: new Date().toISOString(),
        }, { onConflict: 'user_id,skill_id' });

      if (error) throw error;
      
      setSkills(prev => {
        const existing = prev.find(s => s.skill_id === skillId);
        if (existing) {
          return prev.map(s => s.skill_id === skillId 
            ? { ...s, progress, status: status || (progress >= 100 ? 'completed' : 'in_progress') }
            : s
          );
        }
        return [...prev, { skill_id: skillId, progress, status: status || 'in_progress', last_updated: new Date().toISOString() }];
      });
      
      toast.success('Progreso actualizado');
    } catch (error) {
      console.error('Error updating skill:', error);
      toast.error('Error al actualizar progreso');
    }
  };

  const completeLesson = async (lessonId: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('ai_course_lessons')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,lesson_id' });

      if (error) throw error;
      
      setLessons(prev => {
        const existing = prev.find(l => l.lesson_id === lessonId);
        if (existing) {
          return prev.map(l => l.lesson_id === lessonId 
            ? { ...l, completed: true, completed_at: new Date().toISOString() }
            : l
          );
        }
        return [...prev, { lesson_id: lessonId, completed: true, completed_at: new Date().toISOString() }];
      });
      
      toast.success('Lección completada');
    } catch (error) {
      console.error('Error completing lesson:', error);
      toast.error('Error al completar lección');
    }
  };

  const updateProjectProgress = async (projectId: string, progress: number, status?: string) => {
    if (!user) return;

    try {
      const now = new Date().toISOString();
      const newStatus = status || (progress >= 100 ? 'completed' : progress > 0 ? 'active' : 'planned');
      
      const { error } = await supabase
        .from('ai_course_projects')
        .upsert({
          user_id: user.id,
          project_id: projectId,
          progress,
          status: newStatus,
          started_at: progress > 0 ? now : null,
          completed_at: progress >= 100 ? now : null,
        }, { onConflict: 'user_id,project_id' });

      if (error) throw error;
      
      setProjects(prev => {
        const existing = prev.find(p => p.project_id === projectId);
        if (existing) {
          return prev.map(p => p.project_id === projectId 
            ? { ...p, progress, status: newStatus }
            : p
          );
        }
        return [...prev, { project_id: projectId, progress, status: newStatus, started_at: now, completed_at: null }];
      });
      
      toast.success('Proyecto actualizado');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Error al actualizar proyecto');
    }
  };

  const getSkillProgress = (skillId: string): number => {
    return skills.find(s => s.skill_id === skillId)?.progress || 0;
  };

  const getSkillStatus = (skillId: string): string => {
    return skills.find(s => s.skill_id === skillId)?.status || 'in_progress';
  };

  const isLessonCompleted = (lessonId: number): boolean => {
    return lessons.find(l => l.lesson_id === lessonId)?.completed || false;
  };

  const getProjectProgress = (projectId: string): number => {
    return projects.find(p => p.project_id === projectId)?.progress || 0;
  };

  const getProjectStatus = (projectId: string): string => {
    return projects.find(p => p.project_id === projectId)?.status || 'planned';
  };

  return {
    skills,
    lessons,
    projects,
    loading,
    streak,
    updateSkillProgress,
    completeLesson,
    updateProjectProgress,
    getSkillProgress,
    getSkillStatus,
    isLessonCompleted,
    getProjectProgress,
    getProjectStatus,
    refetch: fetchData,
  };
}
