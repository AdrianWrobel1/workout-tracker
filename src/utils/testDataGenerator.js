/**
 * Test Data Generator for Performance Testing
 * 
 * Generates realistic workout data for stress testing
 * Use: 
 *   1. Open DevTools console
 *   2. import { generateTestWorkouts } from './utils/testDataGenerator'
 *   3. const workouts = generateTestWorkouts(5000)
 *   4. await storage.setMany('workouts', workouts)
 *   5. reload to see changes
 */

/**
 * Generate N realistic workouts for load testing
 * Optimized for generating 5000-10000 workouts
 * @param {number} count - Number of workouts to generate (default: 5000)
 * @returns {Array} Array of workout objects
 */
export const generateTestWorkouts = (count = 5000) => {
  const exerciseTemplates = [
    { id: 1, name: 'Bench Press', category: 'Push', difficulty: 'intermediate' },
    { id: 2, name: 'Squat', category: 'Legs', difficulty: 'intermediate' },
    { id: 3, name: 'Deadlift', category: 'Pull', difficulty: 'advanced' },
    { id: 4, name: 'Pull-ups', category: 'Pull', difficulty: 'intermediate' },
    { id: 5, name: 'Dumbbell Rows', category: 'Pull', difficulty: 'beginner' },
    { id: 6, name: 'Leg Press', category: 'Legs', difficulty: 'beginner' },
    { id: 7, name: 'Overhead Press', category: 'Push', difficulty: 'intermediate' },
    { id: 8, name: 'Barbell Curls', category: 'Pull', difficulty: 'beginner' },
  ];

  const workoutNames = [
    'Upper Body Day', 'Lower Body Day', 'Full Body', 'Push Day',
    'Pull Day', 'Leg Day', 'Strength Focus', 'Hypertrophy',
    'Cardio + Weights', 'Recovery Session'
  ];

  const workouts = [];

  for (let i = 0; i < count; i++) {
    const workoutDate = new Date();
    workoutDate.setDate(workoutDate.getDate() - Math.floor(Math.random() * 730)); // Random date within 2 years

    // Random 1-5 exercises per workout
    const exerciseCount = Math.floor(Math.random() * 5) + 1;
    const selectedExercises = [];
    const usedIds = new Set();

    for (let j = 0; j < exerciseCount; j++) {
      let templateIdx;
      do {
        templateIdx = Math.floor(Math.random() * exerciseTemplates.length);
      } while (usedIds.has(templateIdx) && usedIds.size < exerciseTemplates.length);
      
      usedIds.add(templateIdx);
      const template = exerciseTemplates[templateIdx];

      // Generate 2-5 sets per exercise
      const setCount = Math.floor(Math.random() * 4) + 2;
      const sets = [];
      let lastKg = 50 + Math.random() * 100; // Base weight

      for (let s = 0; s < setCount; s++) {
        // Simulate weak first set, stronger subsequent sets
        const warmup = s === 0 ? Math.random() > 0.6 : false;
        const kg = warmup ? lastKg * 0.6 : lastKg + (Math.random() - 0.3) * 5;
        const reps = warmup ? 8 + Math.random() * 4 : 5 + Math.random() * 6;
        
        sets.push({
          kg: Math.round(kg * 2) / 2, // Round to 0.5kg
          reps: Math.round(reps),
          completed: Math.random() > 0.05, // 95% completion rate
          warmup,
          isBest1RM: false,
          isBestSetVolume: false,
          isHeaviestWeight: false
        });

        if (s === setCount - 1) {
          lastKg = kg;
        }
      }

      selectedExercises.push({
        exerciseId: template.id,
        name: template.name,
        category: template.category,
        sets
      });
    }

    workouts.push({
      id: Date.now() + i, // Unique ID
      date: workoutDate.toISOString().split('T')[0],
      name: workoutNames[Math.floor(Math.random() * workoutNames.length)],
      exercises: selectedExercises,
      duration: 30 + Math.random() * 60, // 30-90 minutes
      tags: [],
      notes: Math.random() > 0.7 ? 'Sample notes' : ''
    });
  }

  return workouts;
};

/**
 * Generate test exercises
 * @param {number} count - Number of exercises (default: 50)
 * @returns {Array} Array of exercise objects
 */
export const generateTestExercises = (count = 50) => {
  const exercises = [];
  const categories = ['Push', 'Pull', 'Legs', 'Core', 'Conditioning'];

  for (let i = 0; i < count; i++) {
    exercises.push({
      id: i + 100,
      name: `Exercise ${i + 1}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      isFavorite: Math.random() > 0.8,
      defaultSets: [
        { kg: 50 + Math.random() * 100, reps: 8 + Math.random() * 5 },
        { kg: 50 + Math.random() * 100, reps: 6 + Math.random() * 4 }
      ],
      usesBodyweight: Math.random() > 0.9,
      muscles: []
    });
  }

  return exercises;
};

/**
 * Performance profiling function
 * Run in DevTools to test load times
 */
export const profilePerformance = async (storage, workoutCount = 2000) => {
  console.log(`\n📊 PERFORMANCE PROFILE (${workoutCount} workouts)\n`);

  // Test 1: Generate workouts
  console.time('Generate 2000 workouts');
  const workouts = generateTestWorkouts(workoutCount);
  console.timeEnd('Generate 2000 workouts');

  // Test 2: Save to IndexedDB
  console.time('Save workouts to IndexedDB');
  await storage.setMany('workouts', workouts);
  console.timeEnd('Save workouts to IndexedDB');

  // Test 3: Load from IndexedDB
  console.time('Load workouts from IndexedDB');
  const loaded = await storage.getAllFromStore('workouts');
  console.timeEnd('Load workouts from IndexedDB');

  // Test 4: Filter workouts (simulate HistoryView)
  console.time('Filter workouts (O(N))');
  const filtered = loaded.filter(w => new Date(w.date) > new Date(Date.now() - 90 * 86400000));
  console.timeEnd('Filter workouts (O(N))');

  // Test 5: Calculate PRs (expensive operation)
  const exerciseIds = new Set();
  loaded.forEach(w => {
    w.exercises.forEach(e => exerciseIds.add(e.exerciseId));
  });
  
  console.time('Calculate records for all exercises');
  let recordCount = 0;
  for (const exId of exerciseIds) {
    // Simulate PR calculation
    const hist = loaded.filter(w => w.exercises.some(e => e.exerciseId === exId));
    recordCount++;
  }
  console.timeEnd(`Calculate records for all exercises`);

  console.log(`\n✅ Results:`);
  console.log(`  Workouts loaded: ${loaded.length}`);
  console.log(`  Workouts filtered: ${filtered.length}`);
  console.log(`  Unique exercises: ${exerciseIds.size}`);
  console.log(`  Records calculated: ${recordCount}`);
};

/**
 * Load test data into app
 * Run in DevTools after opening app:
 *   import { loadTestData } from './utils/testDataGenerator'
 *   await loadTestData()
 */
export const loadTestData = async () => {
  try {
    const { storage } = await import('../services/storageService');
    
    console.log('🔄 Loading test data...');
    const workouts = generateTestWorkouts(2000);
    const exercises = generateTestExercises(50);
    
    await storage.setMany('workouts', workouts);
    await storage.setMany('exercises', exercises);
    
    console.log('✅ Loaded 2000 workouts + 50 exercises');
    console.log('💾 Saved to IndexedDB');
    console.log('🔄 Reload the page to see changes');
  } catch (error) {
    console.error('Failed to load test data:', error);
  }
};

/**
 * Comprehensive benchmark for 5000-10000 workouts
 * Measures: load time, filter time, aggregation time, memory
 */
export const comprehensiveBenchmark = async () => {
  try {
    const { storage } = await import('../services/storageService');
    const { getExerciseRecords } = await import('../domain/exercises');
    
    console.log('🚀 COMPREHENSIVE BENCHMARK (5000-10000 workouts)\n');
    
    const sizes = [1000, 2500, 5000, 10000];
    const results = [];
    
    for (const size of sizes) {
      console.log(`\n📊 Testing with ${size} workouts...`);
      
      // Generate
      console.time(`  Generate ${size}`);
      const workouts = generateTestWorkouts(size);
      console.timeEnd(`  Generate ${size}`);
      
      // Save
      console.time(`  Save ${size}`);
      await storage.clear('workouts');
      await storage.setMany('workouts', workouts);
      console.timeEnd(`  Save ${size}`);
      
      // Load
      console.time(`  Load ${size}`);
      const loaded = await storage.getAllFromStore('workouts');
      console.timeEnd(`  Load ${size}`);
      
      // Filter by exercise
      console.time(`  Filter by exercise`);
      const exercises = new Set();
      loaded.forEach(w => w.exercises?.forEach(e => exercises.add(e.exerciseId)));
      const firstExerciseId = Array.from(exercises)[0];
      const exerciseWorkouts = loaded.filter(w => 
        w.exercises?.some(e => e.exerciseId === firstExerciseId)
      );
      console.timeEnd(`  Filter by exercise`);
      
      // Calculate records (expensive)
      console.time(`  Calculate all records`);
      let recordCount = 0;
      for (const exId of exercises) {
        const records = getExerciseRecords(exId, loaded);
        recordCount++;
      }
      console.timeEnd(`  Calculate all records`);
      
      // Memory estimate
      const memBefore = performance.memory?.usedJSHeapSize || 0;
      console.log(`  Workouts: ${loaded.length}, Exercises: ${exercises.size}, Records: ${recordCount}`);
      
      results.push({
        size,
        workoutCount: loaded.length,
        exerciseCount: exercises.size,
        filteredCount: exerciseWorkouts.length
      });
    }
    
    console.log('\n✅ BENCHMARK COMPLETE');
    console.table(results);
  } catch (error) {
    console.error('Benchmark error:', error);
  }
};

/**
 * Simulate Import with chunking
 * Measures: chunk size, total time, UI responsiveness
 */
export const simulateChunkedImport = async (workoutCount = 5000, chunkSize = 100) => {
  try {
    const { storage } = await import('../services/storageService');
    
    console.log(`📥 Simulating chunked import: ${workoutCount} workouts, chunk size ${chunkSize}\n`);
    
    const workouts = generateTestWorkouts(workoutCount);
    let imported = 0;
    
    console.time('Total import time');
    
    for (let i = 0; i < workouts.length; i += chunkSize) {
      const chunk = workouts.slice(i, i + chunkSize);
      
      console.time(`  Chunk ${Math.floor(i / chunkSize) + 1}`);
      await storage.setMany('workouts', chunk);
      console.timeEnd(`  Chunk ${Math.floor(i / chunkSize) + 1}`);
      
      imported += chunk.length;
      const progress = Math.round((imported / workoutCount) * 100);
      console.log(`  Progress: ${progress}% (${imported}/${workoutCount})`);
      
      // Yield to browser
      await new Promise(r => setTimeout(r, 0));
    }
    
    console.timeEnd('Total import time');
    console.log(`✅ Imported ${imported} workouts successfully`);
  } catch (error) {
    console.error('Import simulation error:', error);
  }
};

/**
 * Memory profiling for large datasets
 */
export const profileMemory = async () => {
  if (!performance.memory) {
    console.warn('performance.memory not available (Chrome only)');
    return;
  }
  
  const mem = performance.memory;
  const used = Math.round(mem.usedJSHeapSize / 1024 / 1024);
  const limit = Math.round(mem.jsHeapSizeLimit / 1024 / 1024);
  const total = Math.round(mem.totalJSHeapSize / 1024 / 1024);
  
  console.log(`\n📊 MEMORY PROFILE:`);
  console.log(`  Used: ${used}MB / ${limit}MB (${Math.round(used/limit*100)}%)`);
  console.log(`  Total allocated: ${total}MB`);
  console.log(`  Available: ${limit - used}MB`);
};

