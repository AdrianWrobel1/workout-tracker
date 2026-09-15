import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BODY_ARTWORK, FRONT_VB, BACK_VB } from '../bodyArtwork';
import { MUSCLE_AXES, viewsForMuscle } from '../../analytics/statistics';
import { MuscleBodyMap } from '../MuscleBodyMap';

// Artwork provenance + region contracts for the upstream-adapted Body Map.
// The geometry derives from Melih Colpan / MuscleMap (MIT), converted directly
// from the upstream Swift source — never from openGym's conversion.
describe('bodyArtwork (upstream-adapted geometry)', () => {
  it('uses the upstream male viewBoxes', () => {
    expect(FRONT_VB).toBe('0 95 727 1280');
    expect(BACK_VB).toBe('718 95 727 1280');
  });

  it('covers every canonical axis in its contracted view(s)', () => {
    const frontAxes = Object.keys(BODY_ARTWORK.front.regions);
    const backAxes = Object.keys(BODY_ARTWORK.back.regions);
    for (const axis of MUSCLE_AXES) {
      const views = viewsForMuscle(axis);
      for (const view of views) {
        const axes = view === 'front' ? frontAxes : backAxes;
        expect(axes).toContain(axis);
      }
    }
    expect(frontAxes).toEqual(expect.arrayContaining(['Chest', 'Shoulders', 'Biceps', 'Core', 'Legs']));
    expect(backAxes).toEqual(expect.arrayContaining(['Shoulders', 'Back', 'Triceps', 'Core', 'Legs']));
  });

  it('exposes only canonical axes as regions (no foreign taxonomy)', () => {
    const all = [
      ...Object.keys(BODY_ARTWORK.front.regions),
      ...Object.keys(BODY_ARTWORK.back.regions),
    ];
    for (const axis of all) expect(MUSCLE_AXES).toContain(axis);
    for (const foreign of ['trapezius', 'quadriceps', 'upper-back', 'upperBack', 'forearm', 'hamstring']) {
      expect(all).not.toContain(foreign);
    }
  });

  it('holds valid non-empty SVG path data plus inert silhouette', () => {
    for (const side of ['front', 'back']) {
      expect(BODY_ARTWORK[side].inert.length).toBeGreaterThan(0);
      for (const [axis, paths] of Object.entries(BODY_ARTWORK[side].regions)) {
        expect(paths.length, `${side}/${axis}`).toBeGreaterThan(0);
        for (const d of paths) {
          expect(typeof d).toBe('string');
          expect(d.length, `${side}/${axis}`).toBeGreaterThan(20);
          expect(d[0], `${side}/${axis}`).toMatch(/[Mm]/);
        }
      }
    }
  });

  it('keeps the MIT attribution inside the shipped module', () => {
    const src = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bodyArtwork.js'),
      'utf8'
    );
    expect(src).toContain('Melih Colpan');
    expect(src).toContain('Permission is hereby granted');
  });

  it('renders the adapted artwork with region identity + keyboard contract', () => {
    const html = renderToString(
      <MuscleBodyMap
        setsByMuscle={{ Chest: 4 }}
        stats={{ setsByMuscle: { Chest: 4 }, totalSets: 4 }}
        workouts={[]}
        exercisesDB={[]}
      />
    );
    expect(html).toContain('0 95 727 1280');
    expect(html).not.toContain('0 0 120 276');
    for (const axis of MUSCLE_AXES) expect(html).toContain(axis);
    expect(html).toContain('<path');
    expect(html).toContain('aria-pressed');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex');
  });
});
