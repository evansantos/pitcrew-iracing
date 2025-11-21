import { z } from 'zod';
/**
 * Zod schemas for runtime validation
 */
export declare const TelemetryUpdateSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    sessionTime: z.ZodNumber;
    player: z.ZodObject<{
        speed: z.ZodNumber;
        rpm: z.ZodNumber;
        gear: z.ZodNumber;
        throttle: z.ZodNumber;
        brake: z.ZodNumber;
        lap: z.ZodNumber;
        lapDistPct: z.ZodNumber;
        currentLapTime: z.ZodNumber;
        lastLapTime: z.ZodNumber;
        bestLapTime: z.ZodNumber;
        position: z.ZodNumber;
        classPosition: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        bestLapTime: number;
        position: number;
        lapDistPct: number;
        speed: number;
        rpm: number;
        gear: number;
        throttle: number;
        brake: number;
        lastLapTime: number;
        classPosition: number;
        lap: number;
        currentLapTime: number;
    }, {
        bestLapTime: number;
        position: number;
        lapDistPct: number;
        speed: number;
        rpm: number;
        gear: number;
        throttle: number;
        brake: number;
        lastLapTime: number;
        classPosition: number;
        lap: number;
        currentLapTime: number;
    }>;
    fuel: z.ZodObject<{
        level: z.ZodNumber;
        levelPct: z.ZodNumber;
        usePerHour: z.ZodNumber;
        lapsRemaining: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        level: number;
        levelPct: number;
        usePerHour: number;
        lapsRemaining: number;
    }, {
        level: number;
        levelPct: number;
        usePerHour: number;
        lapsRemaining: number;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    fuel: {
        level: number;
        levelPct: number;
        usePerHour: number;
        lapsRemaining: number;
    };
    sessionTime: number;
    player: {
        bestLapTime: number;
        position: number;
        lapDistPct: number;
        speed: number;
        rpm: number;
        gear: number;
        throttle: number;
        brake: number;
        lastLapTime: number;
        classPosition: number;
        lap: number;
        currentLapTime: number;
    };
}, {
    timestamp: number;
    fuel: {
        level: number;
        levelPct: number;
        usePerHour: number;
        lapsRemaining: number;
    };
    sessionTime: number;
    player: {
        bestLapTime: number;
        position: number;
        lapDistPct: number;
        speed: number;
        rpm: number;
        gear: number;
        throttle: number;
        brake: number;
        lastLapTime: number;
        classPosition: number;
        lap: number;
        currentLapTime: number;
    };
}>;
export declare const OpponentDataSchema: z.ZodObject<{
    carIdx: z.ZodNumber;
    driverName: z.ZodString;
    carNumber: z.ZodString;
    carClass: z.ZodString;
    lap: z.ZodNumber;
    lapDistPct: z.ZodNumber;
    position: z.ZodNumber;
    classPosition: z.ZodNumber;
    lastLapTime: z.ZodNumber;
    bestLapTime: z.ZodNumber;
    estimatedLapTime: z.ZodNumber;
    gapToPlayer: z.ZodNumber;
    gapToLeader: z.ZodNumber;
    isOnPitRoad: z.ZodBoolean;
    pitStopCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    driverName: string;
    bestLapTime: number;
    position: number;
    lapDistPct: number;
    carIdx: number;
    carNumber: string;
    carClass: string;
    lastLapTime: number;
    classPosition: number;
    lap: number;
    estimatedLapTime: number;
    gapToPlayer: number;
    gapToLeader: number;
    isOnPitRoad: boolean;
    pitStopCount: number;
}, {
    driverName: string;
    bestLapTime: number;
    position: number;
    lapDistPct: number;
    carIdx: number;
    carNumber: string;
    carClass: string;
    lastLapTime: number;
    classPosition: number;
    lap: number;
    estimatedLapTime: number;
    gapToPlayer: number;
    gapToLeader: number;
    isOnPitRoad: boolean;
    pitStopCount: number;
}>;
export declare const SessionInfoSchema: z.ZodObject<{
    sessionId: z.ZodString;
    sessionType: z.ZodEnum<["practice", "qualifying", "race", "time_trial", "lone_qualifying"]>;
    trackName: z.ZodString;
    trackId: z.ZodNumber;
    trackLength: z.ZodNumber;
    startTime: z.ZodDate;
    duration: z.ZodNumber;
    laps: z.ZodNumber;
    multiClass: z.ZodBoolean;
    classes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    trackName: string;
    sessionType: "practice" | "race" | "qualifying" | "time_trial" | "lone_qualifying";
    startTime: Date;
    laps: number;
    trackId: number;
    trackLength: number;
    duration: number;
    multiClass: boolean;
    classes: string[];
}, {
    sessionId: string;
    trackName: string;
    sessionType: "practice" | "race" | "qualifying" | "time_trial" | "lone_qualifying";
    startTime: Date;
    laps: number;
    trackId: number;
    trackLength: number;
    duration: number;
    multiClass: boolean;
    classes: string[];
}>;
export declare const StrategyRecommendationSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    sessionTime: z.ZodNumber;
    pitWindow: z.ZodObject<{
        optimal: z.ZodObject<{
            lapStart: z.ZodNumber;
            lapEnd: z.ZodNumber;
            sessionTime: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            sessionTime: number;
            lapStart: number;
            lapEnd: number;
        }, {
            sessionTime: number;
            lapStart: number;
            lapEnd: number;
        }>;
        currentStatus: z.ZodEnum<["early", "optimal", "late", "critical"]>;
        reasoning: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        optimal: {
            sessionTime: number;
            lapStart: number;
            lapEnd: number;
        };
        currentStatus: "critical" | "early" | "optimal" | "late";
        reasoning: string[];
    }, {
        optimal: {
            sessionTime: number;
            lapStart: number;
            lapEnd: number;
        };
        currentStatus: "critical" | "early" | "optimal" | "late";
        reasoning: string[];
    }>;
    fuelStrategy: z.ZodObject<{
        lapsRemaining: z.ZodNumber;
        fuelRemaining: z.ZodNumber;
        canFinish: z.ZodBoolean;
        savingRequired: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        fuelRemaining: number;
        lapsRemaining: number;
        canFinish: boolean;
        savingRequired: boolean;
    }, {
        fuelRemaining: number;
        lapsRemaining: number;
        canFinish: boolean;
        savingRequired: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    sessionTime: number;
    pitWindow: {
        optimal: {
            sessionTime: number;
            lapStart: number;
            lapEnd: number;
        };
        currentStatus: "critical" | "early" | "optimal" | "late";
        reasoning: string[];
    };
    fuelStrategy: {
        fuelRemaining: number;
        lapsRemaining: number;
        canFinish: boolean;
        savingRequired: boolean;
    };
}, {
    timestamp: number;
    sessionTime: number;
    pitWindow: {
        optimal: {
            sessionTime: number;
            lapStart: number;
            lapEnd: number;
        };
        currentStatus: "critical" | "early" | "optimal" | "late";
        reasoning: string[];
    };
    fuelStrategy: {
        fuelRemaining: number;
        lapsRemaining: number;
        canFinish: boolean;
        savingRequired: boolean;
    };
}>;
//# sourceMappingURL=index.d.ts.map