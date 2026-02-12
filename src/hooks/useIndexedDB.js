/**
 * Custom hooks for IndexedDB storage operations
 * Replaces useDebouncedLocalStorage with async IndexedDB saves
 * 
 * Key differences:
 * - useIndexedDBStore: Loads + auto-syncs (replaces old localStorage hook)
 * - Writes are non-blocking async operations
 * - Debounce is per-store, not per-key
 */

import { useEffect, useRef, useCallback } from 'react';
import { storage, STORES } from '../services/storageService';

/**
 * Hook for loading and persisting data from IndexedDB
 * Similar to useDebouncedLocalStorage but async-first
 * 
 * @param {string} storeName - Name of IndexedDB object store (STORES.WORKOUTS, etc)
 * @param {*} value - Current value to persist
 * @param {number} debounceMs - Debounce delay for writes (default: 200ms)
 * @param {Object} options - Additional options
 * @param {boolean} options.skipSave - If true, don't persist this call
 * @returns {void}
 */
export const useIndexedDBStore = (storeName, value, debounceMs = 200, options = {}) => {
  const timeoutRef = useRef(null);
  const { skipSave = false } = options;

  useEffect(() => {
    if (skipSave || !value) return;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule debounced save
    timeoutRef.current = setTimeout(async () => {
      try {
        if (Array.isArray(value)) {
          // For arrays (workouts, exercises, templates), save all items
          await storage.setMany(storeName, value);
        } else if (typeof value === 'object' && value !== null) {
          // For single objects, save with appropriate key
          await storage.set(storeName, value);
        }
      } catch (error) {
        console.error(`Error saving to IndexedDB [${storeName}]:`, error);
      }
    }, debounceMs);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [storeName, value, debounceMs, skipSave]);
};

/**
 * Hook for saving a single setting (non-array)
 * Auto-saves after debounce
 * 
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @param {number} debounceMs - Debounce delay (default: 300ms)
 * @returns {void}
 */
export const useIndexedDBSetting = (key, value, debounceMs = 300) => {
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (typeof key !== 'string' || key === '') return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        await storage.setSetting(key, value);
      } catch (error) {
        console.error(`Error saving setting [${key}]:`, error);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, value, debounceMs]);
};

/**
 * Hook for immediate (non-debounced) IndexedDB operations
 * Use for critical operations that shouldn't wait
 * 
 * @returns {Object} Object with async methods: save, delete, saveSetting
 */
export const useIndexedDBDirect = () => {
  const saveAsync = useCallback(async (storeName, data) => {
    try {
      if (Array.isArray(data)) {
        await storage.setMany(storeName, data);
      } else {
        await storage.set(storeName, data);
      }
      return true;
    } catch (error) {
      console.error(`Error in saveAsync [${storeName}]:`, error);
      return false;
    }
  }, []);

  const deleteAsync = useCallback(async (storeName, id) => {
    try {
      await storage.delete(storeName, id);
      return true;
    } catch (error) {
      console.error(`Error in deleteAsync [${storeName}]:`, error);
      return false;
    }
  }, []);

  const saveSetting = useCallback(async (key, value) => {
    try {
      await storage.setSetting(key, value);
      return true;
    } catch (error) {
      console.error(`Error in saveSetting [${key}]:`, error);
      return false;
    }
  }, []);

  return { saveAsync, deleteAsync, saveSetting };
};
