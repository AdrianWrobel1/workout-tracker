const DAY_MS = 24 * 60 * 60 * 1000;

export const getDateRangeForPeriod = (period, now = new Date()) => {
  const end = new Date(now);
  let days = 90;

  if (period === '7days') days = 7;
  else if (period === '30days') days = 30;
  else if (period === '3months') days = 90;
  else if (period === '1year') days = 365;

  const start = new Date(end.getTime() - (days * DAY_MS));
  return { start, end, days };
};

export const getPreviousRange = ({ start, days }) => {
  const previousEnd = new Date(start.getTime());
  const previousStart = new Date(previousEnd.getTime() - (days * DAY_MS));
  return { start: previousStart, end: previousEnd, days };
};

const createAlignedPoint = (baseItem, mappedItem) => ({
  ...baseItem,
  value: mappedItem?.value || 0,
  hasValue: Number.isFinite(mappedItem?.value),
  sourceLabel: mappedItem?.label || null,
  sourceDate: mappedItem?.date || null
});

export const alignSeriesToCurrent = (currentSeries = [], previousSeries = []) => {
  if (!Array.isArray(currentSeries) || currentSeries.length === 0) return [];
  if (!Array.isArray(previousSeries) || previousSeries.length === 0) {
    return currentSeries.map(item => createAlignedPoint(item, null));
  }

  if (currentSeries.length === previousSeries.length) {
    return currentSeries.map((item, index) => createAlignedPoint(item, previousSeries[index]));
  }

  const lastCurrent = currentSeries.length - 1;
  const lastPrevious = previousSeries.length - 1;

  return currentSeries.map((item, index) => {
    const mappedIndex = lastCurrent > 0
      ? Math.round((index / lastCurrent) * lastPrevious)
      : 0;
    return createAlignedPoint(item, previousSeries[mappedIndex]);
  });
};

export const getClosestPointIndexFromX = ({ x, leftPadding, rightPadding, width, pointCount }) => {
  if (!pointCount || pointCount <= 1) return 0;
  const usableWidth = Math.max(1, width - leftPadding - rightPadding);
  const normalized = (x - leftPadding) / usableWidth;
  const clamped = Math.max(0, Math.min(1, normalized));
  return Math.round(clamped * (pointCount - 1));
};
