import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Key, User, Clock, Filter, SortAsc } from 'lucide-react';
import { useEntries } from '../hooks/useEntries';
import { useCategories } from '../hooks/useCategories';
import { useAuth } from '../hooks/useAuth';
import EntryCard from '../components/EntryCard';
import EntryForm from '../components/EntryForm';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import type { Entry, FilterState, EntryType } from '../types';

const DEFAULT_FILTER: FilterState = {
  search: '',
  type: 'ALL',
  categoryId: null,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  showExpiredOnly: false,
};

export default function Dashboard(): React.ReactElement {
  const { masterPassword } = useAuth();
  const { entries, isLoading, fetchEntries, createEntry, updateEntry, deleteEntry, decryptEntry } = useEntries();
  const { categories, fetchCategories } = useCategories();
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    void fetchEntries(filter);
    void fetchCategories();
  }, []);

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(searchLower) ||
        (e.service?.toLowerCase().includes(searchLower)) ||
        (e.username?.toLowerCase().includes(searchLower)) ||
        (e.url?.toLowerCase().includes(searchLower)) ||
        (e.note?.toLowerCase().includes(searchLower)) ||
        e.categories.some(c => c.name.toLowerCase().includes(searchLower))
      );
    }

    if (filter.type !== 'ALL') {
      result = result.filter(e => e.type === filter.type);
    }

    if (filter.categoryId) {
      result = result.filter(e => e.categories.some(c => c.id === filter.categoryId));
    }

    if (filter.showExpiredOnly) {
      const now = new Date();
      result = result.filter(e => e.expiresAt && new Date(e.expiresAt) < now);
    }

    result.sort((a, b) => {
      let valA: string, valB: string;
      if (filter.sortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (filter.sortBy === 'updatedAt') {
        valA = a.updatedAt;
        valB = b.updatedAt;
      } else {
        valA = a.createdAt;
        valB = b.createdAt;
      }
      return filter.sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    return result;
  }, [entries, filter]);

  const stats = useMemo(() => {
    const now = new Date();
    const soonDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      total: entries.length,
      apiKeys: entries.filter(e => e.type === 'API_KEY').length,
      accounts: entries.filter(e => e.type === 'ACCOUNT').length,
      expiringSoon: entries.filter(e => e.expiresAt && new Date(e.expiresAt) < soonDate && new Date(e.expiresAt) > now).length,
      expired: entries.filter(e => e.expiresAt && new Date(e.expiresAt) < now).length,
    };
  }, [entries]);

  const handleCreate = async (formData: Parameters<typeof createEntry>[0]) => {
    if (!masterPassword) return;
    await createEntry(formData, masterPassword);
    setShowForm(false);
    void fetchEntries();
  };

  const handleUpdate = async (id: string, formData: Parameters<typeof updateEntry>[1]) => {
    if (!masterPassword) return;
    await updateEntry(id, formData, masterPassword);
    setEditingEntry(null);
    void fetchEntries();
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    void fetchEntries();
  };

  const updateFilter = (updates: Partial<FilterState>) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Key className="w-4 h-4 text-secondary" />} label="API Keys" value={stats.apiKeys} />
        <StatCard icon={<User className="w-4 h-4 text-success" />} label="Accounts" value={stats.accounts} />
        <StatCard
          icon={<Clock className="w-4 h-4 text-warning" />}
          label="Expiring Soon"
          value={stats.expiringSoon}
          highlight={stats.expiringSoon > 0}
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-error" />}
          label="Expired"
          value={stats.expired}
          highlight={stats.expired > 0}
          danger
        />
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={filter.search}
          onChange={search => updateFilter({ search })}
          className="flex-1"
        />

        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn-secondary ${showFilters ? 'bg-surface-100' : ''}`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Entry</span>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="card flex flex-wrap gap-4 animate-slide-down">
          {/* Type filter */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Type</label>
            <div className="flex gap-1">
              {(['ALL', 'API_KEY', 'ACCOUNT'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => updateFilter({ type: t as EntryType | 'ALL' })}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    filter.type === t ? 'bg-primary text-base' : 'bg-surface text-text-muted hover:text-text'
                  }`}
                >
                  {t === 'ALL' ? 'All' : t === 'API_KEY' ? 'API Keys' : 'Accounts'}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Sort by</label>
            <div className="flex gap-1">
              {(['createdAt', 'updatedAt', 'name'] as const).map(field => (
                <button
                  key={field}
                  onClick={() => updateFilter({
                    sortBy: field,
                    sortOrder: filter.sortBy === field && filter.sortOrder === 'desc' ? 'asc' : 'desc',
                  })}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm transition-colors ${
                    filter.sortBy === field ? 'bg-primary text-base' : 'bg-surface text-text-muted hover:text-text'
                  }`}
                >
                  {field === 'createdAt' ? 'Created' : field === 'updatedAt' ? 'Updated' : 'Name'}
                  {filter.sortBy === field && <SortAsc className={`w-3 h-3 ${filter.sortOrder === 'desc' ? 'rotate-180' : ''}`} />}
                </button>
              ))}
            </div>
          </div>

          {/* Expired filter */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filter.showExpiredOnly}
                onChange={e => updateFilter({ showExpiredOnly: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-text-muted">Expired only</span>
            </label>
          </div>
        </div>
      )}

      {/* Category Filter */}
      {categories.length > 0 && (
        <CategoryFilter
          categories={categories}
          selectedId={filter.categoryId}
          onSelect={id => updateFilter({ categoryId: id })}
        />
      )}

      {/* Entries */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-16">
          <Key className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-muted text-lg font-medium">
            {entries.length === 0 ? 'No entries yet' : 'No results found'}
          </p>
          <p className="text-text-dim text-sm mt-1">
            {entries.length === 0 ? 'Add your first API key or account' : 'Try adjusting your search or filters'}
          </p>
          {entries.length === 0 && (
            <button onClick={() => setShowForm(true)} className="btn-primary mt-4">
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEntries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              masterPassword={masterPassword!}
              onEdit={e => setEditingEntry(e)}
              onDelete={handleDelete}
              onDecrypt={decryptEntry}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showForm || editingEntry) && (
        <EntryForm
          entry={editingEntry ?? undefined}
          categories={categories}
          masterPassword={masterPassword!}
          onSubmit={editingEntry
            ? (data) => handleUpdate(editingEntry.id, data)
            : handleCreate
          }
          onClose={() => {
            setShowForm(false);
            setEditingEntry(null);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, highlight, danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={`card flex items-center gap-3 ${highlight ? (danger ? 'border-error/30' : 'border-warning/30') : ''}`}>
      {icon}
      <div>
        <p className="text-2xl font-bold text-text">{value}</p>
        <p className="text-xs text-text-muted">{label}</p>
      </div>
    </div>
  );
}
