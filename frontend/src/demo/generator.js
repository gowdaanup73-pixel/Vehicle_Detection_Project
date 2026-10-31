/**
 * generator.js
 * Seeded PRNG (mulberry32) and smooth random-walk helpers for generating
 * realistic, deterministic simulated telemetry and evaluation metrics in Demo Mode.
 */

/**
 * 32-bit seeded pseudo-random number generator.
 * @param {number} seed
 * @returns {() => number} Returns float in [0, 1)
 */
export function mulberry32(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Smooth random walk step with mean reversion and clamping.
 * @param {number} current Current value
 * @param {number} target Target mean to revert toward
 * @param {number} min Minimum clamped bound
 * @param {number} max Maximum clamped bound
 * @param {number} stepSize Maximum random displacement step
 * @param {number} revertFactor Speed of mean reversion [0, 1]
 * @param {() => number} [rng] PRNG function
 * @returns {number} Clamped next value
 */
export function randomWalk(current, target, min, max, stepSize, revertFactor, rng = Math.random) {
  const step = (rng() * 2 - 1) * stepSize;
  const reversion = (target - current) * revertFactor;
  const nextVal = current + step + reversion;
  return Math.max(min, Math.min(max, nextVal));
}

/**
 * Harmonic mean F1 score calculation. Guaranteed to fall in [min(p, r), max(p, r)].
 * @param {number} p Precision in [0, 1]
 * @param {number} r Recall in [0, 1]
 * @returns {number} F1 score in [0, 1]
 */
function calcF1(p, r) {
  if (p <= 0 || r <= 0 || p + r <= 0) return 0;
  return (2 * p * r) / (p + r);
}

/**
 * Returns comparative metrics across models.
 * Proposed model ('Improved CenterNet') is guaranteed to have the highest mAP and F1.
 * @param {number} [seed=42]
 * @param {number} [tick=0]
 * @returns {Array<Object>} List of model metrics
 */
export function getDemoMetrics(seed = 42, tick = 0, prev = null) {
  const rng = mulberry32(seed + tick * 17);
  const prevList = Array.isArray(prev) ? prev : prev?.models;
  const findPrev = (name) => prevList?.find((m) => m.name === name);

  const prevBase = findPrev('Baseline');
  const prevCbam = findPrev('+CBAM');
  const prevBifpn = findPrev('+BiFPN');
  const prevProp = findPrev('Improved CenterNet');
  const prevInt8 = findPrev('INT8');

  // Baseline definitions with small jitter
  const pBase = randomWalk(prevBase?.precision ?? 0.582, 0.582, 0.55, 0.61, 0.005, 0.1, rng);
  const rBase = randomWalk(prevBase?.recall ?? 0.5325, 0.5325, 0.50, 0.56, 0.005, 0.1, rng);
  const f1Base = calcF1(pBase, rBase);

  const pCbam = randomWalk(prevCbam?.precision ?? 0.601, 0.601, 0.57, 0.63, 0.005, 0.1, rng);
  const rCbam = randomWalk(prevCbam?.recall ?? 0.548, 0.548, 0.52, 0.57, 0.005, 0.1, rng);
  const f1Cbam = calcF1(pCbam, rCbam);

  const pBifpn = randomWalk(prevBifpn?.precision ?? 0.623, 0.623, 0.59, 0.65, 0.005, 0.1, rng);
  const rBifpn = randomWalk(prevBifpn?.recall ?? 0.561, 0.561, 0.53, 0.58, 0.005, 0.1, rng);
  const f1Bifpn = calcF1(pBifpn, rBifpn);

  // Proposed model: strictly best metrics
  const pProp = randomWalk(prevProp?.precision ?? 0.665, 0.665, 0.64, 0.69, 0.005, 0.1, rng);
  const rProp = randomWalk(prevProp?.recall ?? 0.584, 0.584, 0.565, 0.61, 0.005, 0.1, rng);
  const f1Prop = calcF1(pProp, rProp);

  const pInt8 = randomWalk(prevInt8?.precision ?? 0.568, 0.568, 0.53, 0.59, 0.005, 0.1, rng);
  const rInt8 = randomWalk(prevInt8?.recall ?? 0.512, 0.512, 0.48, 0.54, 0.005, 0.1, rng);
  const f1Int8 = calcF1(pInt8, rInt8);

  const models = [
    {
      name: 'Baseline',
      precision: Number(pBase.toFixed(4)),
      recall: Number(rBase.toFixed(4)),
      f1: Number(f1Base.toFixed(4)),
      accuracy: Number(randomWalk(0.524, 0.524, 0.50, 0.55, 0.004, 0.1, rng).toFixed(4)),
      mAP50: Number(randomWalk(0.5342, 0.5342, 0.51, 0.55, 0.003, 0.1, rng).toFixed(4)),
      mAP50_95: Number(randomWalk(0.3087, 0.3087, 0.29, 0.33, 0.003, 0.1, rng).toFixed(4)),
      fps: Number((41.5 + rng() * 1.5).toFixed(1)),
      latency_ms: Number((24.1 + rng() * 0.8).toFixed(1)),
      params: 14.8,
      gflops: 32.4,
    },
    {
      name: '+CBAM',
      precision: Number(pCbam.toFixed(4)),
      recall: Number(rCbam.toFixed(4)),
      f1: Number(f1Cbam.toFixed(4)),
      accuracy: Number(randomWalk(0.545, 0.545, 0.52, 0.57, 0.004, 0.1, rng).toFixed(4)),
      mAP50: Number(randomWalk(0.5510, 0.5510, 0.53, 0.57, 0.003, 0.1, rng).toFixed(4)),
      mAP50_95: Number(randomWalk(0.3150, 0.3150, 0.30, 0.33, 0.003, 0.1, rng).toFixed(4)),
      fps: Number((39.8 + rng() * 1.4).toFixed(1)),
      latency_ms: Number((25.1 + rng() * 0.9).toFixed(1)),
      params: 15.6,
      gflops: 34.1,
    },
    {
      name: '+BiFPN',
      precision: Number(pBifpn.toFixed(4)),
      recall: Number(rBifpn.toFixed(4)),
      f1: Number(f1Bifpn.toFixed(4)),
      accuracy: Number(randomWalk(0.567, 0.567, 0.54, 0.59, 0.004, 0.1, rng).toFixed(4)),
      mAP50: Number(randomWalk(0.5680, 0.5680, 0.55, 0.58, 0.003, 0.1, rng).toFixed(4)),
      mAP50_95: Number(randomWalk(0.3240, 0.3240, 0.31, 0.34, 0.003, 0.1, rng).toFixed(4)),
      fps: Number((37.6 + rng() * 1.2).toFixed(1)),
      latency_ms: Number((26.6 + rng() * 0.8).toFixed(1)),
      params: 16.2,
      gflops: 35.2,
    },
    {
      name: 'Improved CenterNet',
      precision: Number(pProp.toFixed(4)),
      recall: Number(rProp.toFixed(4)),
      f1: Number(f1Prop.toFixed(4)),
      accuracy: Number(randomWalk(0.608, 0.608, 0.59, 0.63, 0.004, 0.1, rng).toFixed(4)),
      mAP50: Number(randomWalk(0.5982, 0.5982, 0.585, 0.615, 0.003, 0.1, rng).toFixed(4)),
      mAP50_95: Number(randomWalk(0.3479, 0.3479, 0.335, 0.365, 0.003, 0.1, rng).toFixed(4)),
      fps: Number((36.2 + rng() * 1.2).toFixed(1)),
      latency_ms: Number((27.6 + rng() * 0.9).toFixed(1)),
      params: 16.9,
      gflops: 36.6,
    },
    {
      name: 'INT8',
      precision: Number(pInt8.toFixed(4)),
      recall: Number(rInt8.toFixed(4)),
      f1: Number(f1Int8.toFixed(4)),
      accuracy: Number(randomWalk(0.512, 0.512, 0.49, 0.53, 0.004, 0.1, rng).toFixed(4)),
      mAP50: Number(randomWalk(0.5250, 0.5250, 0.505, 0.54, 0.003, 0.1, rng).toFixed(4)),
      mAP50_95: Number(randomWalk(0.2980, 0.2980, 0.28, 0.315, 0.003, 0.1, rng).toFixed(4)),
      fps: Number((63.5 + rng() * 2.5).toFixed(1)),
      latency_ms: Number((15.7 + rng() * 0.6).toFixed(1)),
      params: 8.5,
      gflops: 18.2,
    },
  ];

  // Attach full payload properties for seamless usage in chart views
  models.models = models;
  models.per_class = getDemoClassMetrics(seed, tick, prev?.per_class);
  models.confusion_matrix = getDemoConfusionMatrix(seed, tick, prev?.confusion_matrix);
  models.per_condition = null;
  models.history = getDemoEpochHistory(seed, tick, prev?.history);

  return models;
}

/**
 * Returns simulated per-class detection metrics for the proposed model.
 * @param {number} [seed=42]
 * @param {number} [tick=0]
 * @returns {Record<string, {precision: number, recall: number, f1: number, ap50: number}>}
 */
export function getDemoClassMetrics(seed = 42, tick = 0, prev = null) {
  const rng = mulberry32(seed + tick * 31 + 101);

  const classes = [
    { name: 'car', pBase: 0.72, rBase: 0.68, apBase: 0.4783 },
    { name: 'van', pBase: 0.63, rBase: 0.54, apBase: 0.3781 },
    { name: 'bus', pBase: 0.68, rBase: 0.59, apBase: 0.4325 },
    { name: 'others', pBase: 0.41, rBase: 0.28, apBase: 0.0555 },
  ];

  const result = {};
  for (const c of classes) {
    const prevItem = prev?.[c.name];
    const p = randomWalk(prevItem?.precision ?? c.pBase, c.pBase, 0.1, 0.95, 0.006, 0.15, rng);
    const r = randomWalk(prevItem?.recall ?? c.rBase, c.rBase, 0.1, 0.95, 0.006, 0.15, rng);
    const f1 = calcF1(p, r);
    const ap = randomWalk(prevItem?.ap50 ?? c.apBase, c.apBase, 0.02, 0.90, 0.004, 0.15, rng);
    result[c.name] = {
      precision: Number(p.toFixed(4)),
      recall: Number(r.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      ap50: Number(ap.toFixed(4)),
    };
  }
  return result;
}

/**
 * Returns a 4x4 confusion matrix with dominant diagonal and subtle off-diagonal confusion.
 * @param {number} [seed=42]
 * @param {number} [tick=0]
 * @returns {{classes: string[], matrix: number[][]}}
 */
export function getDemoConfusionMatrix(seed = 42, tick = 0) {
  const rng = mulberry32(seed + tick * 43 + 202);
  const classes = ['car', 'van', 'bus', 'others'];

  // Base correct detections + confusions
  const baseMatrix = [
    [842, 38, 14, 11],
    [32, 415, 24, 13],
    [10, 19, 288, 7],
    [21, 16, 12, 145],
  ];

  const matrix = baseMatrix.map((row) =>
    row.map((val) => {
      const delta = Math.floor((rng() * 2 - 1) * 6);
      return Math.max(0, val + delta);
    })
  );

  return { classes, matrix };
}


/**
 * Returns 12-epoch training loss and validation mAP progression.
 * @param {number} [seed=42]
 * @param {number} [tick=0]
 * @returns {Array<{epoch: number, train_loss: number, val_loss: number, val_map_50: number}>}
 */
export function getDemoEpochHistory(seed = 42, tick = 0) {
  const rng = mulberry32(seed + tick * 71 + 404);
  const history = [];

  for (let epoch = 1; epoch <= 12; epoch++) {
    const factor = 1.0 / (1.0 + 0.16 * epoch);
    const noise = (rng() * 2 - 1) * 0.02;
    const trainLoss = Math.max(0.2, 2.1 * factor + 0.18 + noise);
    const valLoss = Math.max(0.3, 1.7 * factor + 0.35 + (epoch > 7 ? (epoch - 7) * 0.04 : 0) + noise);
    const valMap = Math.min(0.62, 0.28 + (0.32 * (1.0 - factor)) + noise * 0.5);

    history.push({
      epoch,
      train_loss: Number(trainLoss.toFixed(4)),
      val_loss: Number(valLoss.toFixed(4)),
      val_map_50: Number(valMap.toFixed(4)),
    });
  }

  return history;
}

/**
 * Emits a single traffic telemetry tick with diurnal rush-hour pattern and smooth random walk.
 * @param {number} [tick=0] Sequential tick count
 * @param {number} [seed=42]
 * @returns {{
 *   tick: number,
 *   simulatedHour: number,
 *   timeString: string,
 *   detections: number,
 *   unique_vehicles: number,
 *   fps: number,
 *   latency_ms: number,
 *   occupancy_pct: number,
 *   class_counts: {car: number, van: number, bus: number, others: number},
 *   line_crossings: number
 * }}
 */
export function getDemoTrafficTick(tick = 0, seed = 42) {
  const rng = mulberry32(seed + tick * 89 + 505);

  // Time of day cycle: 1 tick = 6 minutes of simulated time (240 ticks = 24 hours)
  const totalMinutes = (tick * 6) % 1440;
  const hour = totalMinutes / 60;
  const intHour = Math.floor(hour);
  const intMinute = Math.floor(totalMinutes % 60);
  const timeString = `${String(intHour).padStart(2, '0')}:${String(intMinute).padStart(2, '0')}`;

  // Diurnal Rush-Hour Curve:
  // Morning peak ~8:30 AM (spread ~2h), Evening peak ~17:30 PM (spread ~2.5h), Base night ~0.15
  const morningExp = Math.exp(-Math.pow(hour - 8.5, 2) / 4.0);
  const eveningExp = Math.exp(-Math.pow(hour - 17.5, 2) / 6.0);
  const middayLull = 0.45;
  const rushFactor = Math.min(1.0, 0.2 + 0.75 * Math.max(morningExp, eveningExp) + middayLull * 0.2);

  // Smooth random walk for detections
  const baseDetections = 8 + rushFactor * 34; // 8 to 42 vehicles
  const detections = Math.max(3, Math.round(randomWalk(baseDetections, baseDetections, 3, 50, 2.5, 0.2, rng)));

  // Unique vehicles are a stable fraction of visible detections
  const unique_vehicles = Math.max(2, Math.round(detections * (0.8 + rng() * 0.12)));

  // Class distribution roughly proportional to real-world highway traffic
  const carCount = Math.round(detections * (0.68 + (rng() - 0.5) * 0.06));
  const vanCount = Math.round(detections * (0.16 + (rng() - 0.5) * 0.04));
  const busCount = Math.round(detections * (0.10 + (rng() - 0.5) * 0.03));
  const othersCount = Math.max(0, detections - (carCount + vanCount + busCount));

  // FPS inversely correlates with vehicle density on screen
  const targetFps = 42.0 - (detections / 50.0) * 8.0; // 34 to 42 FPS
  const fps = Number(randomWalk(targetFps, targetFps, 28.0, 48.0, 0.8, 0.15, rng).toFixed(1));
  const latency_ms = Number((1000.0 / fps).toFixed(1));

  // Roadway Occupancy Percentage
  const baseOccupancy = 12.0 + rushFactor * 52.0; // 12% to 64%
  const occupancy_pct = Number(randomWalk(baseOccupancy, baseOccupancy, 5.0, 85.0, 1.8, 0.18, rng).toFixed(1));

  // Simulated cumulative line crossings
  const line_crossings = Math.max(1, Math.round(unique_vehicles * (0.35 + rng() * 0.25)));

  return {
    tick,
    simulatedHour: Number(hour.toFixed(2)),
    timeString,
    detections,
    unique_vehicles,
    fps,
    latency_ms,
    occupancy_pct,
    class_counts: {
      car: carCount,
      van: vanCount,
      bus: busCount,
      others: othersCount,
    },
    line_crossings,
  };
}

