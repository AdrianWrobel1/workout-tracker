# Performance Benchmarking Guide

## Quick Start (5 minutes)

### 1. Generate Test Data
Open browser console (F12 → Console) and run:
```javascript
import { generateTestWorkouts, generateTestExercises } from './src/utils/testDataGenerator.js';

// Generate 5000 workouts
const workouts = generateTestWorkouts(5000);
const exercises = generateTestExercises(50);

console.log(`Generated ${workouts.length} workouts`);
```

### 2. Run Comprehensive Benchmark
```javascript
import { comprehensiveBenchmark } from './src/utils/testDataGenerator.js';

await comprehensiveBenchmark();
```

**Output:** Times for 1K/2.5K/5K/10K workouts:
```
Scale: 1000 workouts
  Load time: ~50ms
  Filter time: ~10ms
  Aggregation time: ~5ms
  Memory: ~50MB

Scale: 2500 workouts
  Load time: ~100ms
  Filter time: ~25ms
  ...

Scale: 5000 workouts
  Load time: ~250ms
  Filter time: ~50ms
  ...

Scale: 10000 workouts
  Load time: ~400ms
  Filter time: ~100ms
  ...
```

### 3. Profile Memory
```javascript
import { profileMemory } from './src/utils/testDataGenerator.js';

profileMemory();
// Output: Memory usage stats from Chrome DevTools
```

---

## Detailed Performance Profiling

### A. Chrome DevTools - Performance Tab

**For load time:**
1. Open DevTools (F12)
2. Go to Performance tab
3. Click Record (red circle)
4. Navigate to HistoryView or search for workouts  
5. Stop recording
6. Look at "Main" thread - how long until interactive?
   - ✅ **Good:** <500ms
   - ⚠️ **Acceptable:** <1000ms
   - ❌ **Bad:** >1500ms

**For scrolling FPS:**
1. Open DevTools
2. Go to Performance Monitor (three dots → More tools → Performance Monitor)
3. Watch FPS meter while scrolling HistoryView
4. Scroll through 500+ workout items
   - ✅ **Good:** 55-60 fps
   - ⚠️ **Acceptable:** 40-55 fps
   - ❌ **Bad:** <40 fps

### B. Chrome DevTools - Memory Tab

**To check memory usage:**
1. DevTools → Memory
2. Take heap snapshot
3. Filter by "Object" type
4. Look for:
   - Workout array size
   - DOM node count (should be <100 for virtual lists)
   - Service worker cache size

**Expected @ 5000 workouts:**
- Heap: 150-200 MB
- DOM nodes (HistoryView): ~30-50
- IndexedDB size: ~5-7 MB

### C. Network Tab (I/O Operations)

**To verify selective updates:**
1. Open DevTools → Network
2. Filter by "Fetch" (XHR if using API)
3. Click "Save Workout" button (finish workout)
4. Look at the request payload size:
   - ✅ **Optimized:** <10 kB
   - ⚠️ **Acceptable:** 10-50 kB
   - ❌ **Unoptimized:** >50 kB

**Expected data:**
```json
{
  "id": 1707312345123,
  "date": "2024-02-07",
  "exercises": [...],
  "duration": 45,
  "tags": []
}
// Total: ~100-500 bytes vs 5KB before optimization
```

---

## Manual Performance Tests

### Test 1: Listing/Filtering Performance
**Procedure:**
1. Load app with 5000 workouts
2. Navigate to HISTORY view
3. Toggle filter (All → PR → Heavy → Light)
4. Measure time between click and display update

**Expected:**
- ✅ <150ms filter response time
- ✅ No UI freezing
- ✅ Smooth animation

### Test 2: Scrolling Performance
**Procedure:**
1. HistoryView with 500+ workouts
2. Open DevTools Performance Monitor
3. Fast scroll through list (5 swipes)
4. Check FPS meter

**Expected:**
- ✅ 55-60 fps maintained
- ✅ No jank or stutter
- ✅ Smooth momentum scroll

### Test 3: Set Editing Latency
**Procedure:**
1. Start active workout
2. Edit a set (tap kg field, enter value)
3. Measure time from tap to value appearing

**Expected:**
- ✅ <50ms response time
- ✅ Field updates immediately
- ✅ No lag

### Test 4: Workout Save Performance
**Procedure:**
1. Start workout with 5 exercises
2. Complete all sets
3. Click "Save Workout"
4. Measure time until success toast

**Expected:**
- ✅ <2 seconds end-to-end
- ✅ No UI freeze
- ✅ Smooth transition to summary

### Test 5: Exercise Detail Load
**Procedure:**
1. Go to EXERCISES view
2. Click on an exercise (preferably one with 100+ sets)
3. Measure time until history shows

**Expected:**
- ✅ <300ms load time
- ✅ Smooth scroll of history (60fps)
- ✅ No hanging/loading states

---

## Automated Benchmark Script

Create a file `benchmark.js` in project root:

```javascript
// Run: node benchmark.js
import { comprehensiveBenchmark, simulateChunkedImport, profileMemory } from './src/utils/testDataGenerator.js';

async function runBenchmarks() {
  console.log('\n=== PERFORMANCE BENCHMARK SUITE ===\n');
  
  // Multi-scale testing
  console.log('📊 Running comprehensive scale tests...\n');
  await comprehensiveBenchmark();
  
  // Import performance
  console.log('\n📥 Testing import performance...\n');
  await simulateChunkedImport(5000, 100);
  
  // Memory profiling
  console.log('\n💾 Profiling memory usage...\n');
  profileMemory();
  
  console.log('\n✅ Benchmarks complete!\n');
}

runBenchmarks().catch(console.error);
```

Run with:
```bash
NODE_OPTIONS='--input-type=module' node benchmark.js
```

---

## Mobile Testing

### Physical Device Testing (Recommended)

1. **Device:** iOS 14+ or Android 10+
2. **Browser:** Safari, Chrome, or Edge
3. **Network:** WiFi for baseline, 4G/5G for real-world

**Procedure:**
1. Deploy app to production/staging
2. Open on device
3. Create/load 5000 workout dataset
4. Perform tasks:
   - ✅ Scroll HistoryView (measure smoothness)
   - ✅ Filter by tag (measure responsiveness)  
   - ✅ View ExerciseDetail with 500+ sets (check virtualization)
   - ✅ Edit sets in active workout (measure latency)
   - ✅ Save workout (measure battery drain)

**Success Criteria:**
- ✅ No visible lag or stutter
- ✅ Smooth 60fps scrolling
- ✅ Battery drain <1% per minute
- ✅ App doesn't crash or OOM (Out of Memory)

### Local Mobile Testing

Using Chrome DevTools device emulation:
1. DevTools → Device emulation (Ctrl+Shift+M)
2. Select device (e.g., iPhone 15, Samsung Galaxy S24)
3. Network: "Slow 4G" for realistic conditions
4. Run same tests as above

---

## Metrics to Track Over Time

### Create a log file (optional):

```csv
Date,Workouts,LoadMs,FilterMs,ScrollFps,MemoryMb,IoBytes
2024-02-07,1000,50,10,59,50,1200
2024-02-07,2500,100,25,59,75,2500
2024-02-07,5000,250,50,58,150,5000
2024-02-07,10000,400,100,57,250,8000
```

### Acceptable ranges:
- Load: <500ms @ 5000 items
- Filter: <150ms @ 5000 items
- Scroll FPS: ≥55 fps
- Memory: <300MB @ 5000 items
- I/O: <10KB per save

---

## Troubleshooting

### If performance is worse than expected:

1. **Clear cache:**
   - DevTools → Application → Cache Storage → Delete all
   - Reload (Ctrl+Shift+R hard refresh)

2. **Check for console errors:**
   - DevTools → Console → Any red errors?
   - Fix and rebuild

3. **Verify optimizations active:**
   - DevTools → React DevTools → Profiler
   - Check component render counts
   - Memoized components should show 0 renders on parent change

4. **Profile slow operations:**
   ```javascript
   console.time('filter');
   // do filtering
   console.timeEnd('filter');
   ```

5. **Check for memory leaks:**
   - DevTools → Memory → Take snapshot before and after
   - Memory should decrease after navigation

---

## Reporting Results

When reporting performance, include:

```markdown
## Performance Report - February 7, 2024

**Device:** iPhone 15 / Chrome 120 / macOS 14.2

**Dataset:** 5000 workouts

### Metrics
- Initial load: 280ms
- HistoryView filter: 45ms  
- Exercise scroll FPS: 59fps
- Example save I/O: 250 bytes

### Status
✅ All targets met
✅ No UI freezing detected
✅ Smooth 60fps on mobile
```

---

## Further Reading

- [React DevTools Profiler](https://react-devtools-profiler.github.io/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Web Vitals Core](https://web.dev/vitals/)
- [IndexedDB Performance](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

**Happy benchmarking!** 🚀
