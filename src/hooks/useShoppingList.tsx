import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface ShoppingItem {
  name: string;
  quantity: string;
  category: string;
  checked: boolean;
  fromMeal?: string;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  week_start: string;
  items: ShoppingItem[];
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export const useShoppingList = () => {
  const { user } = useAuth();
  const [currentList, setCurrentList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCurrentList();
    }
  }, [user]);

  const getWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const fetchCurrentList = async () => {
    if (!user) return;
    
    const weekStart = getWeekStart();
    
    try {
      const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setCurrentList({
          ...data,
          items: (data.items as unknown as ShoppingItem[]) || [],
        });
      }
    } catch (error) {
      console.error('Error fetching shopping list:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateFromRecipes = useCallback(async (recipes: Array<{ name: string; ingredients?: string[] }>) => {
    if (!user) return;

    setGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('shopping-list-generator', {
        body: { recipes },
      });

      if (error) throw error;

      const weekStart = getWeekStart();
      const items: ShoppingItem[] = (data.items || []).map((item: any) => ({
        name: item.name,
        quantity: item.quantity || '1',
        category: item.category || 'Otros',
        checked: false,
        fromMeal: item.fromMeal,
      }));

      // Try to find existing list first
      const { data: existingList } = await supabase
        .from('shopping_list')
        .select('id')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .maybeSingle();

      if (existingList) {
        const { data: updatedData, error: updateError } = await supabase
          .from('shopping_list')
          .update({ items: items as unknown as Json })
          .eq('id', existingList.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setCurrentList({ ...updatedData, items });
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('shopping_list')
          .insert({
            user_id: user.id,
            week_start: weekStart,
            items: items as unknown as Json,
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        setCurrentList({ ...insertData, items });
      }

      toast.success('Lista de compra generada');
    } catch (error) {
      console.error('Error generating shopping list:', error);
      toast.error('Error al generar lista de compra');
    } finally {
      setGenerating(false);
    }
  }, [user]);

  const toggleItem = useCallback(async (itemIndex: number) => {
    if (!currentList) return;

    const newItems = [...currentList.items];
    newItems[itemIndex] = { ...newItems[itemIndex], checked: !newItems[itemIndex].checked };

    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ items: newItems as unknown as Json })
        .eq('id', currentList.id);

      if (error) throw error;
      setCurrentList({ ...currentList, items: newItems });
    } catch (error) {
      console.error('Error updating shopping list:', error);
    }
  }, [currentList]);

  const addItem = useCallback(async (item: Omit<ShoppingItem, 'checked'>) => {
    if (!user) return;

    const weekStart = getWeekStart();
    const newItem: ShoppingItem = { ...item, checked: false };

    if (currentList) {
      const newItems = [...currentList.items, newItem];
      
      try {
        const { error } = await supabase
          .from('shopping_list')
          .update({ items: newItems as unknown as Json })
          .eq('id', currentList.id);

        if (error) throw error;
        setCurrentList({ ...currentList, items: newItems });
      } catch (error) {
        console.error('Error adding item:', error);
      }
    } else {
      try {
        const { data, error } = await supabase
          .from('shopping_list')
          .insert({
            user_id: user.id,
            week_start: weekStart,
            items: [newItem] as unknown as Json,
          })
          .select()
          .single();

        if (error) throw error;
        setCurrentList({ ...data, items: [newItem] });
      } catch (error) {
        console.error('Error creating shopping list:', error);
      }
    }
  }, [user, currentList]);

  const removeItem = useCallback(async (itemIndex: number) => {
    if (!currentList) return;

    const newItems = currentList.items.filter((_, i) => i !== itemIndex);

    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ items: newItems as unknown as Json })
        .eq('id', currentList.id);

      if (error) throw error;
      setCurrentList({ ...currentList, items: newItems });
    } catch (error) {
      console.error('Error removing item:', error);
    }
  }, [currentList]);

  const clearList = useCallback(async () => {
    if (!currentList) return;

    try {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('id', currentList.id);

      if (error) throw error;
      setCurrentList(null);
      toast.success('Lista eliminada');
    } catch (error) {
      console.error('Error clearing shopping list:', error);
    }
  }, [currentList]);

  return {
    currentList,
    loading,
    generating,
    generateFromRecipes,
    toggleItem,
    addItem,
    removeItem,
    clearList,
    refetch: fetchCurrentList,
  };
};
