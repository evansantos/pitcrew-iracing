/**
 * Lap Time Predictor
 * Linear regression-based lap time prediction using normal equation: β = (X^T X)^-1 X^T y
 */

export interface LapFeatures {
  tireWear: number;   // avg tire wear 0-1
  fuelLoad: number;   // kg
  trackTemp: number;  // celsius
  lapNumber: number;  // stint lap count
  airTemp: number;    // celsius
}

export interface PredictionResult {
  predictedTime: number;
  confidence: number;   // 0-1, based on R² of the model
  tireCliffRisk: boolean;
}

// ---------------------------------------------------------------------------
// Matrix math helpers (operate on number[][])
// ---------------------------------------------------------------------------

function matMul(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const result: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

function matTranspose(a: number[][]): number[][] {
  const rows = a.length;
  const cols = a[0].length;
  const result: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = a[i][j];
    }
  }
  return result;
}

/**
 * Gauss-Jordan elimination for NxN matrix inversion (max 6x6).
 * Returns null if the matrix is singular.
 */
function matInverse(a: number[][]): number[][] | null {
  const n = a.length;
  // Augment with identity matrix
  const m: number[][] = a.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let pivotRow = -1;
    let maxVal = 0;
    for (let row = col; row < n; row++) {
      if (Math.abs(m[row][col]) > maxVal) {
        maxVal = Math.abs(m[row][col]);
        pivotRow = row;
      }
    }
    if (pivotRow === -1 || maxVal < 1e-12) return null; // singular

    // Swap rows
    [m[col], m[pivotRow]] = [m[pivotRow], m[col]];

    // Scale pivot row
    const pivot = m[col][col];
    for (let j = 0; j < 2 * n; j++) {
      m[col][j] /= pivot;
    }

    // Eliminate column entries
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let j = 0; j < 2 * n; j++) {
        m[row][j] -= factor * m[col][j];
      }
    }
  }

  return m.map((row) => row.slice(n));
}

// ---------------------------------------------------------------------------
// Feature vector helpers
// ---------------------------------------------------------------------------

function featureRow(f: LapFeatures): number[] {
  // Bias + 4 features = 5 columns total.
  // airTemp is omitted to keep the model identifiable with as few as 5 samples.
  return [1, f.tireWear, f.fuelLoad, f.trackTemp, f.lapNumber];
}

function buildX(features: LapFeatures[]): number[][] {
  return features.map(featureRow);
}

// ---------------------------------------------------------------------------
// LapPredictor
// ---------------------------------------------------------------------------

export class LapPredictor {
  private _features: LapFeatures[] = [];
  private _lapTimes: number[] = [];
  private _coefficients: number[] | null = null;
  private _rSquared = 0;

  // Tire-cliff detection state
  private _consecutiveSlowLaps = 0;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Compute linear regression coefficients from the given data.
   * β = (X^T X)^-1 X^T y
   * Also syncs internal storage so predict() works correctly after a direct fit() call.
   */
  fit(features: LapFeatures[], lapTimes: number[]): void {
    // Sync internal storage when called directly (not via addLap)
    this._features = features;
    this._lapTimes = lapTimes;

    if (features.length < 3) {
      this._coefficients = null;
      this._rSquared = 0;
      return;
    }

    const X = buildX(features);
    const y = lapTimes.map((t) => [t]);

    const Xt = matTranspose(X);
    const XtX = matMul(Xt, X);
    const XtXinv = matInverse(XtX);

    if (XtXinv === null) {
      // Singular matrix — fall back to average
      this._coefficients = null;
      this._rSquared = 0;
      return;
    }

    const Xty = matMul(Xt, y);
    const beta = matMul(XtXinv, Xty);
    this._coefficients = beta.map((r) => r[0]);

    this._rSquared = this._computeRSquared(X, lapTimes);
  }

  /**
   * Predict lap time for the given features.
   * Falls back to average with confidence 0 when < 3 data points.
   */
  predict(features: LapFeatures): PredictionResult {
    if (this._lapTimes.length < 3 || this._coefficients === null) {
      const avg =
        this._lapTimes.length === 0
          ? 0
          : this._lapTimes.reduce((s, t) => s + t, 0) / this._lapTimes.length;
      return { predictedTime: avg, confidence: 0, tireCliffRisk: false };
    }

    const row = featureRow(features);
    const predictedTime = row.reduce((sum, val, i) => sum + val * this._coefficients![i], 0);

    return {
      predictedTime,
      confidence: Math.max(0, Math.min(1, this._rSquared)),
      tireCliffRisk: false,
    };
  }

  /**
   * Append a lap to internal storage and refit when >= 5 laps are available.
   */
  addLap(features: LapFeatures, actualTime: number): void {
    this._features.push(features);
    this._lapTimes.push(actualTime);

    if (this._lapTimes.length >= 5) {
      this.fit(this._features, this._lapTimes);
    }
  }

  /**
   * Returns true if the actual lap was significantly slower than predicted
   * for 2 consecutive calls.
   */
  checkTireCliff(predictedTime: number, actualTime: number): boolean {
    const THRESHOLD = 1.5;
    if (actualTime > predictedTime + THRESHOLD) {
      this._consecutiveSlowLaps++;
    } else {
      this._consecutiveSlowLaps = 0;
    }
    return this._consecutiveSlowLaps >= 2;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _computeRSquared(X: number[][], lapTimes: number[]): number {
    if (this._coefficients === null) return 0;

    const mean = lapTimes.reduce((s, t) => s + t, 0) / lapTimes.length;
    let ssTot = 0;
    let ssRes = 0;

    for (let i = 0; i < lapTimes.length; i++) {
      const row = X[i];
      const predicted = row.reduce((s, v, j) => s + v * this._coefficients![j], 0);
      ssTot += (lapTimes[i] - mean) ** 2;
      ssRes += (lapTimes[i] - predicted) ** 2;
    }

    if (ssTot === 0) return 1; // perfect fit (all same value)
    return 1 - ssRes / ssTot;
  }
}
