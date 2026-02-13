import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { ExerciseCard } from '../components/ExerciseCard';
import { VirtualList } from '../components/VirtualList';

export const ExercisesView = ({ exercisesDB, onAddExercise, onEditExercise, onDeleteExercise, onViewDetail, onToggleFavorite }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null); // null for all categories
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowCategoryDropdown(false);
      }
    };
    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCategoryDropdown]);

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
    
    // Separate favorites from others
    const favorites = result.filter(ex => ex.isFavorite).sort((a, b) => a.name.localeCompare(b.name));
    const others = result.filter(ex => !ex.isFavorite).sort((a, b) => a.name.localeCompare(b.name));
    
    return { favorites, others, all: result };
  }, [exercisesDB, searchQuery, categoryFilter]);

  return (
    <div className="min-h-screen bg-black text-white pb-24 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-black to-black/80 border-b border-white/10 p-4 shrink-0 shadow-2xl sticky top-0 z-20">
        <h1 className="text-4xl font-black">EXERCISES</h1>
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

        {/* Category Filter Dropdown */}
        {categories.length > 0 && (
          <div className="relative mb-4" ref={dropdownRef}>
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full bg-slate-800/50 border border-slate-600/50 hover:bg-slate-700/50 text-white rounded-lg px-4 py-3 text-sm font-bold flex items-center justify-between transition"
            >
              <span>Category: {categoryFilter || 'All'}</span>
              <span className={`text-xs transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`}>▾</span>
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