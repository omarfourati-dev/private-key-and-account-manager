import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Key, User, Clock, Filter, SortAsc, AlertTriangle, Shield } from 'lucide-react';
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
      const s = filter.search.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(s) ||
        (e.service?.toLowerCase().includes(s)) ||
        (e.username?.toLowerCase().includes(s)) ||
        (e.url?.toLowerCase().includes(s)) ||
        (e.note?.toLowerCase().includes(s)) ||
        e.categories.some(c => c.name.toLowerCase().includes(s))
      );
    }
    if (filter.type !== 'ALL') result = result.filter(e => e.type === filter.type);
    if (filter.categoryId) result = result.filter(e => e.categories.some(c => c.id === filter.categoryId));
    if (filter.showExpiredOnly) {
      const now = new Date();
      result = result.filter(e => e.expiresAt && new Date(e.expiresAt) < now);
    }
    result.sort((a, b) => {
      let valA: string, valB: string;
      if (filter.sortBy === 'name') { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
      else if (filter.sortBy === 'updatedAt') { valA = a.updatedAt; valB = b.updatedAt; }
      else { valA = a.createdAt; valB = b.createdAt; }
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
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Key className="w-4 h-4" />}
          label="API Keys"
          value={stats.apiKeys}
          color="purple"
        />
        <StatCard
          icon={<User className="w-4 h-4" />}
          label="Accounts"
          value={stats.accounts}
          color="cyan"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Expiring"
          value={stats.expiringSoon}
          color="warning"
          highlight={stats.expiringSoon > 0}
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Expired"
          value={stats.expired}
          color="error"
          highlight={stats.expired > 0}
        />
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <SearchBar
          value={filter.search}
          onChange={search => updateFilter({ search })}
          className="flex-1"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn-secondary gap-1.5 ${showFilters ? 'border-primary/40 text-primary' : ''}`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-sm">Filters</span>
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Entry</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div
          className="rounded-2xl border border-surface p-4 flex flex-wrap gap-5 animate-slide-down"
          style={{ background: 'rgba(20,20,43,0.6)' }}
        >
          {/* Type filter */}
          <div>
            <p className="section-label mb-2">Type</p>
            <div className="flex gap-1.5">
              {(['ALL', 'API_KEY', 'ACCOUNT'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => updateFilter({ type: t as EntryType | 'ALL' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filter.type === t
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-surface text-text-muted hover:text-text border border-transparent'
                  }`}
                >
                  {t === 'ALL' ? 'All' : t === 'API_KEY' ? 'API Keys' : 'Accounts'}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="section-label mb-2">Sort by</p>
            <div className="flex gap-1.5">
              {(['createdAt', 'updatedAt', 'name'] as const).map(field => (
                <button
                  key={field}
                  onClick={() => updateFilter({
                    sortBy: field,
                    sortOrder: filter.sortBy === field && filter.sortOrder === 'desc' ? 'asc' : 'desc',
                  })}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filter.sortBy === field
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-surface text-text-muted hover:text-text border border-transparent'
                  }`}
                >
                  {field === 'createdAt' ? 'Created' : field === 'updatedAt' ? 'Updated' : 'Name'}
                  {filter.sortBy === field && (
                    <SortAsc className={`w-3 h-3 transition-transform ${filter.sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Expired toggle */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div
                className={`w-9 h-5 rounded-full transition-colors duration-200 relative ${
                  filter.showExpiredOnly ? 'bg-primary' : 'bg-surface-200'
                }`}
                onClick={() => updateFilter({ showExpiredOnly: !filter.showExpiredOnly })}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                    filter.showExpiredOnly ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </div>
              <span className="text-xs text-text-muted group-hover:text-text transition-colors">
                Expired only
              </span>
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

      {/* Entries Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface mb-5">
            {entries.length === 0
              ? <Shield className="w-7 h-7 text-text-dim" />
              : <Key className="w-7 h-7 text-text-dim" />
            }
          </div>
          <p className="text-text font-medium mb-1">
            {entries.length === 0 ? 'Your vault is empty' : 'No results found'}
          </p>
          <p className="text-text-muted text-sm mb-6">
            {entries.length === 0
              ? 'Add your first API key or account credential'
              : 'Try adjusting your search or filters'}
          </p>
          {entries.length === 0 && (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add your first entry
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

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'purple' | 'cyan' | 'warning' | 'error';
  highlight?: boolean;
}

function StatCard({ icon, label, value, color, highlight }: StatCardProps) {
  const colorMap = {
    purple: { text: 'text-primary', bg: 'bg-primary/10', glow: 'stat-glow-purple' },
    cyan: { text: 'text-secondary', bg: 'bg-secondary/10', glow: 'stat-glow-cyan' },
    warning: { text: 'text-warning', bg: 'bg-warning/10', glow: 'stat-glow-warning' },
    error: { text: 'text-error', bg: 'bg-error/10', glow: 'stat-glow-error' },
  };
  const c = colorMap[color];

  return (
    <div className={`card flex items-center gap-3 ${highlight ? c.glow : ''}`}>
      <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <span className={c.text}>{icon}</span>
      </div>
      <div>
        <p className="text-xl font-bold text-text leading-none mb-0.5">{value}</p>
        <p className="text-xs text-text-muted">{label}</p>
      </div>
    </div>
  );
}
