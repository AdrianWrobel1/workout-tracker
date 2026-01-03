/**
 * Pure calculation functions
 * No React dependencies
 */

export const calculate1RM = (kg, reps) => {
  if (!kg || !reps) return 0;
  if (reps === 1) return kg;
  return Math.round(kg * (1 + reps / 30));
};

export const calculateTotalVolume = (sets) => {
  return sets
    .filter(s => s.completed)
    .reduce((sum, s) => sum + (s.kg * s.reps), 0);
};

export const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatMonth = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
};

// Compute muscle totals for a workout using the rules provided by the user.
// Returns an object with axes: Back, Legs, Chest, Arms, Core, Shoulders (normalized 0..1)
export const computeMuscleTotals = (workout) => {
  const groups = {}; // muscle -> totalVolume

  const mapToAxis = (m) => {
    if (!m) return null;
    const s = m.toLowerCase();
    if (s.includes('chest') || s.includes('pec')) return 'Chest';
    if (s.includes('back') || s.includes('lat')) return 'Back';
    if (s.includes('leg') || s.includes('quad') || s.includes('ham')) return 'Legs';
    if (s.includes('shoulder') || s.includes('delt')) return 'Shoulders';
    if (s.includes('core') || s.includes('abs')) return 'Core';
    if (s.includes('trice') || s.includes('bicep') || s.includes('arm')) return 'Arms';
    return null;
  };

  (workout.exercises || []).forEach(ex => {
    let exVolume = 0;
    (ex.sets || []).forEach(s => {
      const kg = Number(s.kg) || 0;
      const reps = Number(s.reps) || 0;
      exVolume += kg * reps;
    });

    const muscles = ex.muscles || [];
    if (muscles.length > 0) {
      muscles.forEach(m => {
        const axis = mapToAxis(m);
        if (axis) groups[axis] = (groups[axis] || 0) + exVolume;
      });
    } else if (ex.category) {
      const axis = mapToAxis(ex.category);
      if (axis) groups[axis] = (groups[axis] || 0) + exVolume;
    }
  });

  const axes = ['Chest', 'Shoulders', 'Back', 'Arms', 'Core', 'Legs'];
  const values = axes.map(a => groups[a] || 0);
  const maxVal = Math.max(...values, 1);

  const normalized = {};
  axes.forEach(a => {
    normalized[a] = (groups[a] || 0) / maxVal;
  });

  return normalized;
};

export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};