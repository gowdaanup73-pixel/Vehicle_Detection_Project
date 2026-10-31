/**
 * useDemoData.js
 * React hook managing Demo Mode state and user-triggered refresh.
 *
 * Supports:
 * - Persistent opt-in toggle (localStorage with try/catch fallback, VITE_DEMO_MODE env)
 * - Refresh-driven dataset generation: calling refresh() creates a new dataset with a new seed,
 *   smoothly drifting from the previous dataset via random-walk.
 * - Rolling window of 30 points for time-series charts.
 * - No background intervals or timers.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDemoClassMetrics,
  getDemoConfusionMatrix,
  getDemoEpochHistory,
  getDemoMetrics,
  getDemoTrafficTick,
} from './generator.js';

const STORAGE_KEY = 'demo_mode';
const ROLLING_WINDOW_SIZE = 30;

/**
 * Safely resolves initial demo mode setting.
 * Priority: 1. VITE_DEMO_MODE env, 2. localStorage, 3. Default false (OFF)
 */
export function getStoredDemoMode() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DEMO_MODE === 'true') {
      return true;
    }
  } catch {
    // ignore
  }

  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val !== null) {
      return val === 'true';
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Safely stores demo mode setting.
 */
export function setStoredDemoMode(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // ignore
  }
}

/**
 * Custom hook providing refresh-driven simulated demo data.
 * @param {boolean} [overrideEnabled] Optional manual override
 */
export function useDemoData(overrideEnabled = undefined) {
  const [isDemoMode, setIsDemoModeState] = useState(() => {
    return overrideEnabled !== undefined ? overrideEnabled : getStoredDemoMode();
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [tick, setTick] = useState(0);

  // Initial datasets
  const [demoMetrics, setDemoMetricsState] = useState(() => getDemoMetrics(42, 0));
  const [demoClassMetrics, setDemoClassMetricsState] = useState(() => getDemoClassMetrics(42, 0));
  const [demoConfusionMatrix, setDemoConfusionMatrixState] = useState(() => getDemoConfusionMatrix(42, 0));
  const [demoEpochHistory, setDemoEpochHistoryState] = useState(() => getDemoEpochHistory(42, 0));
  const [currentTickData, setCurrentTickDataState] = useState(() => getDemoTrafficTick(0));

  const [rollingHistory, setRollingHistory] = useState(() => {
    const initialPoints = [];
    for (let i = 0; i < ROLLING_WINDOW_SIZE; i++) {
      const t = getDemoTrafficTick(i);
      initialPoints.push({
        tick: t.tick,
        time: t.timeString,
        date: t.timeString,
        detections: t.detections,
        unique_vehicles: t.unique_vehicles,
        fps: t.fps,
        latency_ms: t.latency_ms,
        occupancy_pct: t.occupancy_pct,
        class_counts: t.class_counts,
        car: t.class_counts.car,
        van: t.class_counts.van,
        bus: t.class_counts.bus,
        others: t.class_counts.others,
      });
    }
    return initialPoints;
  });

  const tickRef = useRef(0);
  const metricsRef = useRef(demoMetrics);
  const classMetricsRef = useRef(demoClassMetrics);
  const confusionMatrixRef = useRef(demoConfusionMatrix);
  const epochHistoryRef = useRef(demoEpochHistory);
  const currentTickRef = useRef(currentTickData);

  /**
   * @param {boolean} [val]
   */
  const toggleDemoMode = useCallback((val = undefined) => {
    setIsDemoModeState((prev) => {
      const nextVal = typeof val === 'boolean' ? val : !prev;
      setStoredDemoMode(nextVal);
      return nextVal;
    });
  }, []);

  useEffect(() => {
    if (overrideEnabled !== undefined) {
      setIsDemoModeState(overrideEnabled);
    }
  }, [overrideEnabled]);

  const refresh = useCallback(() => {
    const nextSeed = Date.now();
    const nextTick = tickRef.current + 1;
    tickRef.current = nextTick;

    // Generate new smoothly drifting dataset using previous state
    const newMetrics = getDemoMetrics(nextSeed, nextTick, metricsRef.current);
    const newClassMetrics = getDemoClassMetrics(nextSeed, nextTick, classMetricsRef.current);
    const newConfusionMatrix = getDemoConfusionMatrix(nextSeed, nextTick, confusionMatrixRef.current);
    const newEpochHistory = getDemoEpochHistory(nextSeed, nextTick, epochHistoryRef.current);
    const newTickData = getDemoTrafficTick(nextTick, currentTickRef.current, nextSeed);

    const formattedPoint = {
      tick: newTickData.tick,
      time: newTickData.timeString,
      date: newTickData.timeString,
      detections: newTickData.detections,
      unique_vehicles: newTickData.unique_vehicles,
      fps: newTickData.fps,
      latency_ms: newTickData.latency_ms,
      occupancy_pct: newTickData.occupancy_pct,
      class_counts: newTickData.class_counts,
      car: newTickData.class_counts.car,
      van: newTickData.class_counts.van,
      bus: newTickData.class_counts.bus,
      others: newTickData.class_counts.others,
    };

    metricsRef.current = newMetrics;
    classMetricsRef.current = newClassMetrics;
    confusionMatrixRef.current = newConfusionMatrix;
    epochHistoryRef.current = newEpochHistory;
    currentTickRef.current = newTickData;

    setTick(nextTick);
    setDemoMetricsState(newMetrics);
    setDemoClassMetricsState(newClassMetrics);
    setDemoConfusionMatrixState(newConfusionMatrix);
    setDemoEpochHistoryState(newEpochHistory);
    setCurrentTickDataState(newTickData);
    setRollingHistory((prev) => {
      const next = [...prev, formattedPoint];
      return next.length > ROLLING_WINDOW_SIZE ? next.slice(next.length - ROLLING_WINDOW_SIZE) : next;
    });
    setRefreshKey((k) => k + 1);
  }, []);

  const fullDemoMetricsPayload = {
    models: demoMetrics,
    per_class: demoClassMetrics,
    confusion_matrix: demoConfusionMatrix,
    per_condition: null,
    history: demoEpochHistory,
    error: null,
  };

  return {
    isDemoMode,
    setDemoMode: toggleDemoMode,
    refreshKey,
    refresh,
    tick,
    currentTickData,
    rollingHistory,
    metrics: fullDemoMetricsPayload,
    classMetrics: demoClassMetrics,
    confusionMatrix: demoConfusionMatrix,
    epochHistory: demoEpochHistory,
  };
}

export default useDemoData;
