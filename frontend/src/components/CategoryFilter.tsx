import React from 'react';
import { Tag } from 'lucide-react';
import { useT } from '../i18n';
import type { Category } from '../types';

interface CategoryFilterProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function CategoryFilter({ categories, selectedId, onSelect }: CategoryFilterProps): React.ReactElement {
  const { t } = useT();
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={`badge py-1 px-3 cursor-pointer transition-colors ${
          !selectedId ? 'bg-primary/20 text-primary' : 'bg-surface text-text-muted hover:bg-surface-100'
        }`}
      >
        {t('filter.allCategories')}
      </button>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(selectedId === cat.id ? null : cat.id)}
          className={`badge py-1 px-3 cursor-pointer transition-all ${
            selectedId === cat.id ? 'ring-1' : 'opacity-70 hover:opacity-100'
          }`}
          style={{
            backgroundColor: `${cat.color}20`,
            color: cat.color,
            ['--tw-ring-color' as string]: cat.color,
          } as React.CSSProperties}
        >
          <Tag className="w-2.5 h-2.5 mr-1" />
          {cat.name}
          {cat._count && <span className="ml-1 opacity-70">({cat._count.entries})</span>}
        </button>
      ))}
    </div>
  );
}
