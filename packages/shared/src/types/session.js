/**
 * Session and race management types
 */
export var SessionType;
(function (SessionType) {
    SessionType["Practice"] = "practice";
    SessionType["Qualifying"] = "qualifying";
    SessionType["Race"] = "race";
    SessionType["TimeTrial"] = "time_trial";
    SessionType["LoneQualifying"] = "lone_qualifying";
})(SessionType || (SessionType = {}));
export var PitStopReason;
(function (PitStopReason) {
    PitStopReason["Fuel"] = "fuel";
    PitStopReason["Tires"] = "tires";
    PitStopReason["Damage"] = "damage";
    PitStopReason["Strategy"] = "strategy";
    PitStopReason["Emergency"] = "emergency";
})(PitStopReason || (PitStopReason = {}));
export var RaceEventType;
(function (RaceEventType) {
    RaceEventType["SessionStart"] = "session_start";
    RaceEventType["SessionEnd"] = "session_end";
    RaceEventType["FlagChange"] = "flag_change";
    RaceEventType["PitEntry"] = "pit_entry";
    RaceEventType["PitExit"] = "pit_exit";
    RaceEventType["Incident"] = "incident";
    RaceEventType["FastestLap"] = "fastest_lap";
    RaceEventType["PositionChange"] = "position_change";
    RaceEventType["DriverJoin"] = "driver_join";
    RaceEventType["DriverLeave"] = "driver_leave";
})(RaceEventType || (RaceEventType = {}));
//# sourceMappingURL=session.js.map