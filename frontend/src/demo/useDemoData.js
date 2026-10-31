/**
 * useDemoData.js
 * React hook managing Demo Mode state and continuous 2500ms telemetry ticks.
 * Supports:
 * - Persistent opt-in toggle (localStorage with try/catch fallback, VITE_DEMO_MODE env)
 * - Auto-pausing when browser tab is hidden (document.hidden)
 * - Rolling window of 30 points for time-series charts
 * - Clean interval teardown on unmount
 */
import { useEffect, useRef, useState } from 'react';
import {
  getDemoClassMetrics,
  getDemoConditionMap,
  getDemoConfusionMatrix,
  getDemoEpochHistory,
  getDemoMetrics,
  getDemoTrafficTick,
} from './generator';

const STORAGE_KEY = 'demo_mode';
const TICK_INTERVAL_MS = 2500;
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
 * Custom hook providing live-ticking simulated demo data.
 * @param {boolean} [overrideEnabled] Optional manual override
 */
export function useDemoData(overrideEnabled = undefined) {
  const [isDemoMode, setIsDemoModeState] = useState(() => {
    return overrideEnabled !== undefined ? overrideEnabled : getStoredDemoMode();
  });

  const [tick, setTick] = useState(0);
  const [rollingHistory, setRollingHistory] = useState(() => {
    // Pre-populate with the initial 30 points so charts are immediately populated
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

  const isPausedRef = useRef(false);
  const tickRef = useRef(ROLLING_WINDOW_SIZE);

  const toggleDemoMode = (val) => {
    const nextVal = typeof val === 'boolean' ? val : !isDemoMode;
    setIsDemoModeState(nextVal);
    setStoredDemoMode(nextVal);
  };

  useEffect(() => {
    if (overrideEnabled !== undefined) {
      setIsDemoModeState(overrideEnabled);
    }
  }, [overrideEnabled]);

  useEffect(() => {
    if (!isDemoMode) {
      return;
    }

    // Visibility change handler to pause ticks when the tab is backgrounded
    const handleVisibilityChange = () => {
      isPausedRef.current = document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = setInterval(() => {
      if (isPausedRef.current) {
        return;
      }

      const nextTick = tickRef.current + 1;
      tickRef.current = nextTick;
      setTick(nextTick);

      const newPoint = getDemoTrafficTick(nextTick);
      const formatted = {
        tick: newPoint.tick,
        time: newPoint.timeString,
        date: newPoint.timeString,
        detections: newPoint.detections,
        unique_vehicles: newPoint.unique_vehicles,
        fps: newPoint.fps,
        latency_ms: newPoint.latency_ms,
        occupancy_pct: newPoint.occupancy_pct,
        class_counts: newPoint.class_counts,
        car: newPoint.class_counts.car,
        van: newPoint.class_counts.van,
        bus: newPoint.class_counts.bus,
        others: newPoint.class_counts.others,
      };

      setRollingHistory((prev) => {
        const next = [...prev, formatted];
        if (next.length > ROLLING_WINDOW_SIZE) {
          return next.slice(next.length - ROLLING_WINDOW_SIZE);
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isDemoMode]);

  // Derived live demo data structures
  const currentTickData = getDemoTrafficTick(tick);
  const demoMetrics = getDemoMetrics(42, tick);
  const demoClassMetrics = getDemoClassMetrics(42, tick);
  const demoConfusionMatrix = getDemoConfusionMatrix(42, tick);
  const demoConditionMap = getDemoConditionMap(42, tick);
  const demoEpochHistory = getDemoEpochHistory(42, tick);

  const fullDemoMetricsPayload = {
    models: demoMetrics,
    per_class: demoClassMetrics,
    confusion_matrix: demoConfusionMatrix,
    per_condition: demoConditionMap,
    history: demoEpochHistory,
    error: null,
  };

  return {
    isDemoMode,
    setDemoMode: toggleDemoMode,
    tick,
    currentTickData,
    rollingHistory,
    metrics: fullDemoMetricsPayload,
    classMetrics: demoClassMetrics,
    confusionMatrix: demoConfusionMatrix,
    conditionMap: demoConditionMap,
    epochHistory: demoEpochHistory,
  };
}

export default useDemoData;
