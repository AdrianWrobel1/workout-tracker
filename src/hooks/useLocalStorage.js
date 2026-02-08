import { useEffect, useRef } from 'react';

/**
 * Custom hook for debounced localStorage persistence
 * @param {string} key - localStorage key
 * @param {*} value - value to persist (will be JSON stringified)
 * @param {number} delay - debounce delay in ms (default: 1000)
 */
export const useDebouncedLocalStorage = (key, value, delay = 1000) => {
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(value));
    }, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, value, delay]);
};

/**
 * Custom hook for debounced localStorage with manual trigger
 * Useful for operations like activeWorkout that need immediate save but also cleanup on removal
 */
export const useDebouncedLocalStorageManual = (key, value, delay = 1000) => {
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (value !== null && value !== undefined) {
      timeoutRef.current = setTimeout(() => {
        localStorage.setItem(key, JSON.stringify(value));
      }, delay);
    } else {
      // Immediately remove if value is null/undefined
      localStorage.removeItem(key);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, value, delay]);
};
