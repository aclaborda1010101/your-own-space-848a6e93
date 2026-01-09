import { useState, useCallback, useRef } from 'react';

interface Recipe {
  recipe_name: string;
  servings: number;
  prep_time?: string;
  cook_time?: string;
  calories_per_serving?: number;
  difficulty?: string;
  ingredients: any[];
  traditional_steps: any[];
  thermomix_steps: any[];
  nutrition_info?: any;
  tips?: string[];
}

// Session cache for recipes - persists during the session
const recipeCache = new Map<string, Recipe>();

export const useRecipeCache = () => {
  const getCacheKey = useCallback((mealName: string) => {
    return mealName.toLowerCase().trim();
  }, []);

  const getCachedRecipe = useCallback((mealName: string): Recipe | null => {
    const key = getCacheKey(mealName);
    return recipeCache.get(key) || null;
  }, [getCacheKey]);

  const cacheRecipe = useCallback((mealName: string, recipe: Recipe) => {
    const key = getCacheKey(mealName);
    recipeCache.set(key, recipe);
  }, [getCacheKey]);

  const clearCache = useCallback(() => {
    recipeCache.clear();
  }, []);

  const getCacheSize = useCallback(() => {
    return recipeCache.size;
  }, []);

  return {
    getCachedRecipe,
    cacheRecipe,
    clearCache,
    getCacheSize,
  };
};
