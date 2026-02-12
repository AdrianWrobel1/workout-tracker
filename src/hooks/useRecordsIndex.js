/**
 * PR Records Cache Manager
 * 
 * Instead of calling getExerciseRecords() which iterates all workouts O(N),
 * we maintain a cache: Map<exerciseId, records>
 * 
 * Cache is updated on:
 * - Workout finish
 * - Set edits (kg/reps change)
 * - Set toggle (complete/incomplete)
 * - Import
 * 
 * Cache is invalidated on:
 * - Workout delete
 * - Import (full rebuild)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { storage } from '../services/storageService';
import { getExerciseRecords, getExerciseHistory } from '../domain/exercises';

/**
 * Hook to manage PR records cache
 * @returns {Object}
 */
export const useRecordsIndex = () => {
  const [recordsIndex, setRecordsIndex] = useState(new Map());
  const loadedRef = useRef(false);

  // Load cache from IndexedDB on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const cached = await storage.getAllFromStore('recordsIndex');
        const map = new Map();
        cached.forEach(item => {
          map.set(item.exerciseId, item.records);
        });
        setRecordsIndex(map);
      } catch (error) {
        console.error('Failed to load records cache:', error);
        setRecordsIndex(new Map());
      }
    })();
  }, []);

  /**
   * Update cache for a single exercise
   * Called when:
   * - Workout is finished (includes this exercise)
   * - A set in this exercise is edited
   * - A set is toggled
   * 
   * @param {*} exerciseId - Exercise ID
   * @param {Array} workouts - All workouts array (for calculation)
   */
  const updateRecordForExercise = useCallback(
    async (exerciseId, workouts) => {
      if (!exerciseId || !Array.isArray(workouts)) return;

      try {
        // Calculate fresh records for this exercise
        const records = getExerciseRecords(exerciseId, workouts);

        // Update in-memory map
        setRecordsIndex(prev => {
          const newMap = new Map(prev);
          newMap.set(exerciseId, records);
          return newMap;
        });

        // Persist to IndexedDB
        await storage.setRecordsIndex(exerciseId, records);
      } catch (error) {
        console.error(`Failed to update records for exercise ${exerciseId}:`, error);
      }
    },
    []
  );

  /**
   * Update cache for multiple exercises at once
   * Called when workout is finished (contains multiple exercises)
   * Much more efficient than calling updateRecordForExercise multiple times
   * 
   * @param {Array} exerciseIds - Array of exercise IDs
   * @param {Array} workouts - All workouts array
   */
  const updateRecordsForExercises = useCallback(
    async (exerciseIds, workouts) => {
      if (!Array.isArray(exerciseIds) || !Array.isArray(workouts)) return;

      try {
        const updates = {};
        const newMap = new Map(recordsIndex);

        // Calculate records for each exercise
        exerciseIds.forEach(exId => {
          if (exId) {
            const records = getExerciseRecords(exId, workouts);
            updates[exId] = records;
            newMap.set(exId, records);
          }
        });

        // Batch update in-memory map
        setRecordsIndex(newMap);

        // Batch persist to IndexedDB
        const promises = Object.entries(updates).map(([exId, records]) =>
          storage.setRecordsIndex(exId, records)
        );
        await Promise.all(promises);
      } catch (error) {
        console.error('Failed to update records for exercises:', error);
      }
    },
    [recordsIndex]
  );

  /**
   * Rebuild entire cache from scratch
   * Called after import or when data integrity is in question
   * This is expensive (O(N*M)) but only called on import
   * 
   * @param {Array} workouts - All workouts
   * @param {Array} exercises - All exercises (to know which to build cache for)
   */
  const rebuildIndex = useCallback(
    async (workouts, exercises) => {
      try {
        const newMap = new Map();

        // Only build cache for exercises that exist
        const exerciseIds = exercises.map(e => e.id);

        exerciseIds.forEach(exId => {
          const records = getExerciseRecords(exId, workouts);
          newMap.set(exId, records);
        });

        setRecordsIndex(newMap);

        // Clear old cache and save new one
        await storage.clearRecordsIndex();
        const promises = Array.from(newMap.entries()).map(([exId, records]) =>
          storage.setRecordsIndex(exId, records)
        );
        await Promise.all(promises);

        console.log(`✓ Rebuilt records index for ${newMap.size} exercises`);
      } catch (error) {
        console.error('Failed to rebuild records index:', error);
      }
    },
    []
  );

  /**
   * Get cached records for an exercise (instant lookup O(1))
   * @param {*} exerciseId - Exercise ID
   * @returns {Object|null} Records or null if not cached
   */
  const getRecords = useCallback(
    (exerciseId) => {
      return recordsIndex.get(exerciseId) || null;
    },
    [recordsIndex]
  );

  /**
   * Clear entire cache (call on import start)
   */
  const clearCache = useCallback(async () => {
    setRecordsIndex(new Map());
    await storage.clearRecordsIndex();
  }, []);

  return {
    recordsIndex,
    updateRecordForExercise,
    updateRecordsForExercises,
    rebuildIndex,
    getRecords,
    clearCache
  };
};
