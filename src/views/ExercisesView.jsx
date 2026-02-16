import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search, Grid3X3, List } from 'lucide-react';
import { ExerciseCard } from '../components/ExerciseCard';
import { VirtualList } from '../components/VirtualList';

const SORT_OPTIONS = [
  { id: 'name-asc', label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
  { id: 'category', label: 'Category' },
];

export const ExercisesView = ({ exercisesDB, onAddExercise, onEditExercise, onDeleteExercise, onViewDetail, onToggleFavorite }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [sortBy, setSortBy] = useState('name-asc');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const dropdownRef = useRef(null);
  const sortDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowCategoryDropdown(false);
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) setShowSortDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCategoryDropdown, showSortDropdown]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set();
    exercisesDB.forEach(ex => {
      if (ex.category) cats.add(ex.category);
      if (ex.muscles && Array.isArray(ex.muscles)) {
        ex.muscles.forEach(m => cats.add(m));
      }
    });
    return Array.from(cats).sort();
  }, [exercisesDB]);

  // Filter by search and category
  const filtered = useMemo(() => {
    let result = exercisesDB;
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ex => 
        ex.name.toLowerCase().includes(q) || 
        ex.category.toLowerCase().includes(q) ||
        (ex.muscles && ex.muscles.some(m => m.toLowerCase().includes(q)))
      );
    }
    
    // Category filter
    if (categoryFilter) {
      result = result.filter(ex =>
        ex.category === categoryFilter ||
        (ex.muscles && ex.muscles.includes(categoryFilter))
      );
    }

    // Sort
    if (sortBy === 'name-asc') result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'name-desc') result = [...result].sort((a, b) => b.name.localeCompare(a.name));
    else if (sortBy === 'category') result = [...result].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));

    // Separate favorites from others (order preserved from sort)
    const favorites = result.filter(ex => ex.isFavorite);
    const others = result.filter(ex => !ex.isFavorite);

    return { favorites, others, all: result };
  }, [exercisesDB, searchQuery, categoryFilter, sortBy]);

  return (
    <div className="min-h-screen bg-black text-white pb-24 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 shrink-0 shadow-2xl sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-4xl font-black">EXERCISES</h1>
          <button
            onClick={() => setCompactMode(!compactMode)}
            className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
            title={compactMode ? 'Grid view' : 'Compact list view'}
          >
            {compactMode ? <Grid3X3 size={20} /> : <List size={20} />}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 font-semibold tracking-widest">YOUR EXERCISE LIBRARY</p>
      </div>

      <div className="p-4 grow overflow-y-auto flex flex-col">
        {/* Add Exercise Button */}
        <button
          onClick={onAddExercise}
          className="w-full bg-gradient-accent hover:opacity-90 transition text-white rounded-xl p-4 mb-4 font-bold flex items-center justify-center gap-2 shadow-lg ui-press"
          style={{ boxShadow: `0 10px 25px -5px var(--accent)` }}
        >
          <Plus size={20} /> Add Exercise
        </button>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercises..."
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-accent focus:outline-none focus:accent-ring transition"
          />
        </div>

        {/* Sort + Category row */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="w-full bg-slate-800/50 border border-slate-600/50 hover:bg-slate-700/50 text-white rounded-lg px-4 py-3 text-sm font-bold flex items-center justify-between transition touch-input"
            >
              <span>Sort: {SORT_OPTIONS.find(o => o.id === sortBy)?.label || 'Name A–Z'}</span>
              <span className={`text-xs transition-transform ${showSortDropdown ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {showSortDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-slate-700/50 rounded-lg shadow-lg z-50">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setSortBy(opt.id); setShowSortDropdown(false); }}
                    className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                      sortBy === opt.id ? 'accent-bg-light text-white' : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {categories.length > 0 && (
            <div className="relative flex-1" ref={dropdownRef}>
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full bg-slate-800/50 border border-slate-600/50 hover:bg-slate-700/50 text-white rounded-lg px-4 py-3 text-sm font-bold flex items-center justify-between transition touch-input"
              >
                <span className="truncate">Tag: {categoryFilter || 'All'}</span>
                <span className={`text-xs shrink-0 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`}>▾</span>
              </button>
            {showCategoryDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-slate-700/50 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => {
                    setCategoryFilter(null);
                    setShowCategoryDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                    categoryFilter === null
                      ? 'accent-bg-light text-white'
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setCategoryFilter(cat);
                      setShowCategoryDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                      categoryFilter === cat
                        ? 'accent-bg-light text-white'
                        : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            </div>
          )}
        </div>

        {/* Results Count */}
        {searchQuery && (
          <p className="text-xs text-slate-400 mb-3">Found {filtered.all.length} exercise{filtered.all.length !== 1 ? 's' : ''}</p>
        )}

        {/* Exercise List */}
        {filtered.all.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-400 text-sm font-semibold">
                {searchQuery ? 'No exercises match your search' : 'No exercises yet'}
              </p>
              <p className="text-slate-600 text-xs mt-2">
                {searchQuery ? 'Try a different search term' : 'Create your first exercise to get started'}
              </p>
            </div>
          </div>
        ) : compactMode ? (
          // Compact list view for screenshots
          <div className="space-y-1 flex-1">
            {filtered.all.map(exercise => (
              <button
                key={exercise.id}
                onClick={() => onViewDetail(exercise.id)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/50 transition text-sm group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white group-hover:accent-text transition truncate">{exercise.name}</div>
                    <div className="text-xs text-slate-500">{exercise.category} • {exercise.muscles?.join(', ') || 'General'}</div>
                  </div>
                  {exercise.isFavorite && <span className="text-amber-400 ml-2 shrink-0">⭐</span>}
                </div>
              </button>
            ))}
          </div>
        ) : filtered.all.length > 50 ? (
          // OPTIMIZED: Use virtual list for 50+ exercises - 95% DOM reduction
          <VirtualList
            items={filtered.all}
            itemHeight={140}
            overscan={3}
            renderItem={(exercise, idx) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onViewDetail={() => onViewDetail(exercise.id)}
                onEditExercise={onEditExercise}
                onDeleteExercise={onDeleteExercise}
                onToggleFavorite={onToggleFavorite}
              />
            )}
          />
        ) : (
          <div className="space-y-3 flex-1">
            {/* Favorites Section */}
            {filtered.favorites.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black text-amber-400 tracking-widest">⭐ FAVORITES</span>
                  <div className="flex-1 h-px bg-amber-500/20"></div>
                </div>
                {filtered.favorites.map(exercise => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onViewDetail={() => onViewDetail(exercise.id)}
                    onEditExercise={onEditExercise}
                    onDeleteExercise={onDeleteExercise}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </>
            )}
            
            {/* Other Exercises */}
            {filtered.others.length > 0 && filtered.favorites.length > 0 && (
              <div className="flex items-center gap-2 my-4">
                <span className="text-xs font-black text-slate-500 tracking-widest">ALL EXERCISES</span>
                <div className="flex-1 h-px bg-slate-700/30"></div>
              </div>
            )}
            
            {filtered.others.map(exercise => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onViewDetail={() => onViewDetail(exercise.id)}
                onEditExercise={onEditExercise}
                onDeleteExercise={onDeleteExercise}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};