# Wave 2: Competitive Edge — Design Spec

**Goal:** Add predictive analytics, racing line analysis, multi-stint strategy optimization, and driver performance scoring to give drivers a measurable competitive advantage.

**Wave Scope:** 6 specs (023-028)

**Prerequisites:** Wave 1 merged (REST endpoints, FileStore, replay, test coverage).

---

## Spec 023 — Lap Time Prediction

### Overview
Predict upcoming lap times based on tire wear, fuel load, track conditions, and historical data. Combines a base model from stored sessions with live updates during the current session.

### Architecture

**Prediction Model**
- Linear regression with features: tire wear (avg 4 corners), fuel load (kg), track temp (°C), lap number (stint age), air temp
- Coefficients computed from historical laps in the same track/car combination
- On session start: load stored sessions from `GET /api/sessions`, filter by matching track+car, extract feature vectors from frames at each lap boundary
- During session: recalculate coefficients every 5 laps as new data comes in (expanding window)

**Tire Cliff Detection**
- Monitor residuals (predicted vs actual). If actual lap time exceeds prediction by > 1.5s for 2 consecutive laps, emit a "tire cliff" alert
- This indicates tires have fallen off a performance cliff and pit is urgent

**Data Flow**
```
FileStore (historical sessions) → extract lap features → fit linear regression
Live telemetry (per lap) → append to feature matrix → refit → predict next lap
Prediction → dashboard widget + alert system
```

### Service
- `apps/api/src/services/prediction/lap-predictor.ts`
  - `LapPredictor` class: `fit(features, lapTimes)`, `predict(currentFeatures)`, `addLap(features, lapTime)`
  - Pure math, no external ML library — linear regression via normal equation (X^T X)^-1 X^T y
  - Returns `{ predictedTime: number, confidence: number, tireCliffRisk: boolean }`

### Frontend
- `apps/web/components/telemetry/lap-prediction.tsx` — dashboard widget showing predicted next lap time, confidence bar, tire cliff warning
- Integrates with existing alert system (`useAlerts`) for tire cliff

### Acceptance Criteria
- Prediction accuracy within 1s after 5+ laps of data
- Tire cliff detected within 2 laps of onset
- Works with zero historical data (falls back to simple average)
- No external ML dependencies

---

## Spec 024 — Racing Line Analysis

### Overview
Overlay the driver's current racing line against their best lap on the existing D3.js track map. Color-coded deviation indicator.

### Architecture

**Reference Line**
- Best lap (fastest lap time) in current session stored as the reference
- Sampled at 100 equidistant track positions (lapDistPct 0.00, 0.01, ..., 0.99)
- For each sample point: store speed, throttle, brake, x/y position (derived from lapDistPct)

**Live Comparison**
- As current lap progresses, compare each telemetry frame against the nearest reference point
- Speed differential determines color: green (within 5 km/h), yellow (5-15 km/h slower), red (>15 km/h slower), blue (>5 km/h faster)
- Track map draws two lines: reference (dim) and current (bright, color-coded)

**Data Flow**
```
Best lap frames → sample at 100 points → store as referenceLine[]
Live telemetry → find nearest reference point → compute speed diff → color segment
D3.js track map → render both lines
```

### Service
- `apps/api/src/services/analysis/racing-line.ts`
  - `buildReferenceLine(frames: StoredFrame[]): ReferencePoint[]`
  - `compareToReference(current: TelemetryFrame, reference: ReferencePoint[]): LineDeviation`
  - `ReferencePoint = { dist: number, speed: number, throttle: number, brake: number }`
  - `LineDeviation = { dist: number, speedDiff: number, color: string }`

### Frontend
- Modify `apps/web/components/telemetry/track-map.tsx` — add reference line overlay and color-coded current line
- Hover tooltip: "Speed diff: -12 km/h vs best at 45% track"

### Acceptance Criteria
- Reference line updates when a new fastest lap is set
- Color coding updates at 60Hz with current telemetry
- Works with minimum 1 completed lap (uses that as reference)
- No visual performance regression on track map

---

## Spec 025 — Tire Compound Strategy Optimizer

### Overview
Multi-stint race planner using dynamic programming. Given race parameters and compound wear data, compute optimal stint splits.

### Architecture

**Compound Data**
- Track wear rate per compound from session data (laps on compound vs wear percentage)
- If no data for a compound, use defaults: Soft (1.5% per lap), Medium (0.8% per lap), Hard (0.5% per lap)
- Pace delta per compound: Soft (-0.5s vs Medium baseline), Hard (+0.3s vs Medium baseline)
- These are configurable overrides stored in localStorage

**Dynamic Programming Optimizer**
- State: `(lapsRemaining, currentCompound, tireAge)`
- Decision: pit now or continue
- Cost: lap time (base + compound delta + degradation curve + fuel weight) + pit stop time if pitting
- Degradation curve: quadratic `baseLapTime + k * tireAge^2` where k varies by compound
- Outputs: array of `{ compound, stintLength, expectedTime }` for the optimal strategy

**Integration with Spec 026**
- Pit stop time comes from the fuel/pit model
- Fuel load per stint comes from the fuel optimizer
- Combined optimization: "Pit on lap 15, change to Hard, fuel for 20 laps"

### Service
- `apps/api/src/services/strategy/stint-optimizer.ts`
  - `StintOptimizer` class
  - `optimize(params: RaceParams): StintPlan`
  - `RaceParams = { totalLaps, currentLap, compounds: CompoundData[], pitStopTime, fuelPerLap, baseLapTime }`
  - `StintPlan = { stints: Stint[], totalTime: number, alternativeStrategies: StintPlan[] }`
  - `Stint = { compound: string, startLap: number, endLap: number, fuelLoad: number, expectedTime: number }`

### Frontend
- `apps/web/components/strategy/stint-planner.tsx` — visual timeline of planned stints (colored bars per compound), alternative strategies listed below
- Inputs: total race laps (auto-filled from session), compound overrides
- Recalculates live as wear data accumulates

### Acceptance Criteria
- Computes optimal strategy in < 100ms for races up to 200 laps
- Shows top 3 alternative strategies with time deltas
- Handles 1-3 available compounds
- Recalculates when wear data changes significantly (> 0.1% per lap deviation)

---

## Spec 026 — Fuel & Pit Strategy Modeling

### Overview
Model pit stop mechanics and optimize fuel loads per stint. Provides the pit time and fuel data that the tire compound optimizer (spec 025) needs.

### Architecture

**Pit Stop Time Model**
- Components: pit lane travel time (track-specific, configurable, default 25s) + fuel fill time (fuel amount / fill rate) + tire change time (fixed, default 3s)
- Fill rate: configurable per series (default 0.5 liters/sec for GT, 1.0 for prototypes)
- Total pit time = pitLaneTime + max(fuelFillTime, tireChangeTime) (fuel and tire change happen in parallel)

**Fuel Load Optimizer**
- Given: stint length, fuel per lap (from telemetry), tank capacity
- Calculate: minimum fuel to complete stint + 1 lap safety margin
- Lap time impact: fuel weight effect on pace (~0.03s per kg, configurable)
- Trade-off: carry less fuel = faster laps but more pit stops

**What-If Scenarios**
- "If I pit now" vs "If I pit in N laps" — calculate net race time for each option
- Factor in: current fuel, tire state, remaining laps, pit stop time, fuel load delta
- Returns: time delta (positive = costs time, negative = saves time)

### Service
- `apps/api/src/services/strategy/pit-model.ts`
  - `PitModel` class
  - `calculatePitTime(params: PitParams): number`
  - `optimizeFuelLoad(stintLaps, fuelPerLap, tankCapacity): { fuelLoad: number, timeImpact: number }`
  - `whatIf(currentState, pitNow: boolean, pitInNLaps: number): WhatIfResult`
  - `PitParams = { pitLaneTime, fuelAmount, fillRate, tireChange: boolean }`
  - `WhatIfResult = { pitNowTime: number, pitLaterTime: number, delta: number, recommendation: string }`

### Frontend
- `apps/web/components/strategy/pit-calculator.tsx` — shows pit time breakdown, fuel load recommendation, what-if comparison
- Integrates into existing strategy hub on dashboard

### Acceptance Criteria
- Pit time calculation matches real pit stops within 2s
- What-if scenarios compute in < 50ms
- Fuel load optimizer recommends minimum safe fuel
- All parameters configurable (pit lane time, fill rate, fuel weight effect)

---

## Spec 027 — Sector Analysis

### Overview
Auto-detect meaningful track sectors from telemetry data. Show split times, sector comparisons, and highlight weakest sectors.

### Architecture

**Sector Detection Algorithm**
1. Take a complete lap of telemetry frames
2. Compute speed derivative (dSpeed/dDist) at each point
3. Find braking zones: where speed drops > 30 km/h within 2% track distance
4. Each braking zone marks a sector boundary
5. Merge boundaries that are < 5% track distance apart
6. Result: array of sector boundaries (as lapDistPct values)
7. Cache per track+car combo (sectors don't change between sessions)

**Granularity**
- Default: auto-detected sectors (~4-8 depending on track)
- Mini-sectors: subdivide each auto-detected sector into 2-3 equal parts for finer analysis
- User can toggle between standard and mini-sector views

**Split Times**
- For each sector: entry time, exit time, sector time = exit - entry
- Delta vs best lap sector time (green/red)
- Cumulative delta shown at each sector boundary
- Weakest sector highlighted: "Sector 4 is costing you 0.8s vs your best"

### Service
- `apps/api/src/services/analysis/sector-analyzer.ts`
  - `detectSectors(frames: StoredFrame[]): SectorBoundary[]`
  - `calculateSplits(frames: StoredFrame[], sectors: SectorBoundary[]): SectorSplit[]`
  - `compareSplits(current: SectorSplit[], reference: SectorSplit[]): SectorDelta[]`
  - `SectorBoundary = { index: number, startDist: number, endDist: number, type: 'braking' | 'straight' }`
  - `SectorSplit = { sector: number, time: number, entrySpeed: number, minSpeed: number, exitSpeed: number }`
  - `SectorDelta = { sector: number, delta: number, isWeakest: boolean }`

### Frontend
- `apps/web/components/analysis/sector-splits.tsx` — sector time table with deltas, weakest sector badge
- Integrates into the `/analysis` page (below lap comparison)
- Optional: sector boundaries drawn on track map as dashed lines

### Acceptance Criteria
- Auto-detection produces sensible sectors for common tracks (Spa, Monza, Sebring, Daytona)
- Sectors cached per track+car combo
- Split times accurate to within 0.01s
- Weakest sector correctly identified per lap
- Mini-sector toggle functional

---

## Spec 028 — Driver Performance Scoring

### Overview
Composite driver rating (0-100) built from consistency, racecraft, and improvement metrics. Displayed as a radar chart on a dedicated stats page.

### Architecture

**Consistency Score (0-100, weight: 40%)**
- Lap time standard deviation (lower = better)
- % of laps within 1% of best lap time
- Scoring: stddev < 0.3s = 100, < 0.5s = 80, < 1.0s = 60, < 2.0s = 40, else 20
- Outlier laps (pit laps, incident laps with > 5s gap) excluded from calculation

**Racecraft Score (0-100, weight: 30%)**
- Positions gained from start to finish (normalized by grid size)
- Overtakes: count of position improvements between laps
- Gap management: standard deviation of gap to car ahead (lower = better at maintaining)
- Incident avoidance: laps without yellow flag involvement
- Requires opponent data from telemetry

**Improvement Score (0-100, weight: 30%)**
- Personal best trend: compare best lap time this session vs best from last 5 sessions on same track+car
- Session improvement: how much faster is your best lap vs your average in the current session
- Learning rate: how many laps to reach within 1% of session best (fewer = higher score)

**Composite Score**
- Weighted average: `consistency * 0.4 + racecraft * 0.3 + improvement * 0.3`
- Stored per session in FileStore session index (new field: `driverScore`)
- Historical scores queryable for trend analysis

### Service
- `apps/api/src/services/scoring/driver-scorer.ts`
  - `DriverScorer` class
  - `calculateConsistency(lapTimes: number[]): ConsistencyScore`
  - `calculateRacecraft(positions: number[], opponents: OpponentData[]): RacecraftScore`
  - `calculateImprovement(currentBest: number, historicalBests: number[]): ImprovementScore`
  - `calculateComposite(c, r, i): CompositeScore`
  - Each sub-score returns `{ score: number, breakdown: Record<string, number> }`

### Frontend
- `apps/web/app/stats/page.tsx` — dedicated stats page
- Radar chart (5 axes: consistency, lap time control, overtaking, gap management, improvement)
- Session history table with scores per session
- Trend line chart showing composite score over time
- Add "Stats" to nav bar

### Acceptance Criteria
- Scores compute at end of each session
- Radar chart renders with 5 axes
- Historical trend shows last 20 sessions
- Outlier laps (pit, incidents) excluded from consistency
- Works with minimum 3 completed laps per session

---

## Implementation Order

**Dependencies:**
1. **027** (sectors) — independent, foundational for analysis
2. **023** (prediction) — independent, uses FileStore data
3. **026** (fuel/pit model) — independent, provides data for 025
4. **025** (tire optimizer) — depends on 026 for pit time model
5. **024** (racing line) — independent, modifies track map
6. **028** (scoring) — depends on all others being testable, uses lap/sector data

**Parallel groups:**
- Group A: 027 + 023 + 026 (all independent)
- Group B: 025 + 024 (025 depends on 026, 024 independent)
- Group C: 028 (depends on session data)

---

## Roadmap Context

| Wave | Theme | Specs | Status |
|------|-------|-------|--------|
| 1 | Polish & Production | 017-022 | PR #3 open |
| **2 (this)** | Competitive Edge | 023-028 | Design |
| 3 | Social & Multi-user | 029-034 | Planned |
| 4 | Mobile & Accessibility | 035-040 | Planned |
