import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import type { Category } from '../types';

interface UseCategoriesReturn {
  categories: Category[];
  isLoading: boolean;
  fetchCategories: () => Promise<void>;
  createCategory: (name: string, color?: string) => Promise<Category>;
  updateCategory: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<{ categories: Category[] }>('/categories');
      setCategories(data.categories);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCategory = useCallback(async (name: string, color?: string): Promise<Category> => {
    const { data } = await api.post<{ category: Category }>('/categories', { name, color });
    setCategories(prev => [...prev, data.category].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(`Category "${name}" created`);
    return data.category;
  }, []);

  const updateCategory = useCallback(async (id: string, updateData: { name?: string; color?: string }) => {
    const { data } = await api.put<{ category: Category }>(`/categories/${id}`, updateData);
    setCategories(prev => prev.map(c => c.id === id ? data.category : c));
    toast.success('Category updated');
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    await api.delete(`/categories/${id}`);
    setCategories(prev => prev.filter(c => c.id !== id));
    toast.success('Category deleted');
  }, []);

  return { categories, isLoading, fetchCategories, createCategory, updateCategory, deleteCategory };
}
