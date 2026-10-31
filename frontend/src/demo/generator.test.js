import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  mulberry32,
  getDemoMetrics,
  getDemoClassMetrics,
  getDemoConfusionMatrix,
  getDemoConditionMap,
  getDemoEpochHistory,
  getDemoTrafficTick,
} from './generator.js';

describe('Demo Generator Unit Tests', () => {
  test('Determinism with fixed seed', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      assert.equal(rng1(), rng2());
    }

    const metrics1 = getDemoMetrics(999);
    const metrics2 = getDemoMetrics(999);
    assert.deepEqual(metrics1, metrics2);

    const tick1 = getDemoTrafficTick(0, { detections: 25, fps: 28 }, 777);
    const tick2 = getDemoTrafficTick(0, { detections: 25, fps: 28 }, 777);
    assert.deepEqual(tick1, tick2);
  });

  test('Values within [0, 1] for rates and probabilities', () => {
    const metrics = getDemoMetrics(100);
    assert.ok(metrics.models && metrics.models.length > 0);

    for (const m of metrics.models) {
      for (const key of ['precision', 'recall', 'f1', 'accuracy', 'mAP50', 'mAP50_95']) {
        const val = m[key];
        assert.ok(typeof val === 'number', `${m.name} ${key} is not number`);
        assert.ok(!Number.isNaN(val), `${m.name} ${key} is NaN`);
        assert.ok(val >= 0 && val <= 1, `${m.name} ${key} = ${val} out of [0, 1]`);
      }
    }

    const classMetrics = getDemoClassMetrics(100);
    for (const [className, cm] of Object.entries(classMetrics)) {
      for (const key of ['precision', 'recall', 'f1', 'ap50']) {
        const val = cm[key];
        assert.ok(typeof val === 'number', `${className} ${key} is not number`);
        assert.ok(!Number.isNaN(val), `${className} ${key} is NaN`);
        assert.ok(val >= 0 && val <= 1, `${className} ${key} = ${val} out of [0, 1]`);
      }
    }

    const conditionMap = getDemoConditionMap(100);
    for (const [cond, val] of Object.entries(conditionMap)) {
      assert.ok(typeof val === 'number', `${cond} is not number`);
      assert.ok(!Number.isNaN(val), `${cond} is NaN`);
      assert.ok(val >= 0 && val <= 1, `${cond} = ${val} out of [0, 1]`);
    }
  });

  test('F1 is bounded between min and max of precision and recall', () => {
    for (const seed of [1, 42, 100, 2024, 99999]) {
      const metrics = getDemoMetrics(seed);
      for (const m of metrics.models) {
        const minPR = Math.min(m.precision, m.recall);
        const maxPR = Math.max(m.precision, m.recall);
        assert.ok(
          m.f1 >= minPR - 1e-4 && m.f1 <= maxPR + 1e-4,
          `${m.name} F1 (${m.f1}) not between min(${minPR}) and max(${maxPR})`
        );
      }

      const classMetrics = getDemoClassMetrics(seed);
      for (const [className, cm] of Object.entries(classMetrics)) {
        const minPR = Math.min(cm.precision, cm.recall);
        const maxPR = Math.max(cm.precision, cm.recall);
        assert.ok(
          cm.f1 >= minPR - 1e-4 && cm.f1 <= maxPR + 1e-4,
          `${className} F1 (${cm.f1}) not between min(${minPR}) and max(${maxPR})`
        );
      }
    }
  });

  test('No NaN values across all generator outputs', () => {
    const metrics = getDemoMetrics(42);
    const jsonStr = JSON.stringify(metrics);
    assert.ok(!jsonStr.includes('NaN'), 'metrics JSON includes NaN');
    assert.ok(!jsonStr.includes('null'), 'demo metrics should be fully populated');

    const cm = getDemoConfusionMatrix(42);
    assert.ok(cm.matrix && cm.matrix.length === 4);
    for (const row of cm.matrix) {
      assert.equal(row.length, 4);
      for (const cell of row) {
        assert.ok(typeof cell === 'number' && !Number.isNaN(cell) && cell >= 0);
      }
    }

    const history = getDemoEpochHistory(42);
    assert.ok(history.length >= 10);
    for (const ep of history) {
      assert.ok(typeof ep.epoch === 'number' && !Number.isNaN(ep.epoch));
      assert.ok(typeof ep.train_loss === 'number' && !Number.isNaN(ep.train_loss) && ep.train_loss > 0);
      assert.ok(typeof ep.val_loss === 'number' && !Number.isNaN(ep.val_loss) && ep.val_loss > 0);
      assert.ok(typeof ep.val_map_50 === 'number' && !Number.isNaN(ep.val_map_50) && ep.val_map_50 >= 0 && ep.val_map_50 <= 1);
    }

    let prevTick = null;
    for (let tickIdx = 0; tickIdx < 50; tickIdx++) {
      const tick = getDemoTrafficTick(tickIdx, prevTick, tickIdx * 17);
      prevTick = tick;
      for (const [k, v] of Object.entries(tick)) {
        if (typeof v === 'number') {
          assert.ok(!Number.isNaN(v), `tick.${k} is NaN at tick ${tickIdx}`);
        }
      }
      for (const [cls, cnt] of Object.entries(tick.class_counts)) {
        assert.ok(typeof cnt === 'number' && !Number.isNaN(cnt) && cnt >= 0, `class_counts.${cls} invalid`);
      }
    }
  });

  test('Proposed model has best overall performance', () => {
    const metrics = getDemoMetrics(42);
    const proposed = metrics.models.find((m) => m.name === 'Improved CenterNet');
    assert.ok(proposed, 'Improved CenterNet must exist');
    for (const other of metrics.models) {
      if (other.name !== 'Improved CenterNet') {
        assert.ok(
          proposed.mAP50 >= other.mAP50,
          `Proposed mAP50 (${proposed.mAP50}) should be >= ${other.name} (${other.mAP50})`
        );
      }
    }
  });
});
