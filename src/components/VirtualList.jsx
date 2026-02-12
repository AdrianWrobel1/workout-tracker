/**
 * Virtual List Component for High-Performance Rendering
 * 
 * Renders only visible items in the viewport, dramatically improving performance
 * when dealing with 500+ items.
 * 
 * Performance:
 * - Without virtualization: 500 items = 500 DOM nodes = slow
 * - With virtualization: ~20-30 visible items = 20-30 DOM nodes = fast
 * 
 * Usage:
 * <VirtualList
 *   items={filteredWorkouts}
 *   itemHeight={200}
 *   containerHeight={800}
 *   renderItem={(item, index) => <WorkoutCard {...item} />}
 * />
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export const VirtualList = ({
  items = [],
  itemHeight = 100,
  containerHeight = 600,
  renderItem = (item) => <div>{String(item)}</div>,
  overscan = 5, // Number of items to render above/below viewport for smoother scrolling
  keyExtractor = (item, index) => index // Function to extract key from item
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef(null);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const itemCount = items.length;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(itemCount, startIndex + visibleCount + overscan * 2);

    return {
      startIndex,
      endIndex,
      visibleCount,
      offsetY: startIndex * itemHeight
    };
  }, [items.length, itemHeight, containerHeight, scrollTop, overscan]);

  // Items to render
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex);
  }, [items, visibleRange]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  // Total height of all items
  const totalHeight = items.length * itemHeight;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleRange.offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={keyExtractor(item, visibleRange.startIndex + index)}
              style={{
                height: itemHeight,
                overflow: 'hidden'
              }}
            >
              {renderItem(item, visibleRange.startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Advanced Virtual List with dynamic item heights
 * Use when items have different heights (more complex but flexible)
 */
export const DynamicVirtualList = ({
  items = [],
  containerHeight = 600,
  renderItem = (item) => <div>{String(item)}</div>,
  getItemHeight = (item, index) => 100,
  overscan = 3,
  keyExtractor = (item, index) => index
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef(null);
  const itemHeightCache = useRef({});

  // Calculate item positions (memoized)
  const itemOffsets = useMemo(() => {
    const offsets = [0];
    let totalHeight = 0;

    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(items[i], i);
      totalHeight += height;
      offsets.push(totalHeight);
    }

    return offsets;
  }, [items, getItemHeight]);

  // Find visible range based on scroll position
  const visibleRange = useMemo(() => {
    let startIndex = 0;
    let endIndex = items.length;

    // Binary search for start index
    for (let i = 0; i < items.length; i++) {
      if (itemOffsets[i + 1] > scrollTop - overscan * 100) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
    }

    // Find end index
    const viewportBottom = scrollTop + containerHeight;
    for (let i = startIndex; i < items.length; i++) {
      if (itemOffsets[i] > viewportBottom + overscan * 100) {
        endIndex = i + overscan;
        break;
      }
    }

    return {
      startIndex,
      endIndex,
      offsetY: itemOffsets[startIndex]
    };
  }, [items.length, scrollTop, containerHeight, itemOffsets, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex);
  }, [items, visibleRange]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  const totalHeight = itemOffsets[items.length] || 0;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleRange.offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={keyExtractor(item, visibleRange.startIndex + index)}
            >
              {renderItem(item, visibleRange.startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
