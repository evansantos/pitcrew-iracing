/**
 * Core telemetry data types for iRacing SDK integration
 */
export var SessionState;
(function (SessionState) {
    SessionState[SessionState["Invalid"] = 0] = "Invalid";
    SessionState[SessionState["GetInCar"] = 1] = "GetInCar";
    SessionState[SessionState["Warmup"] = 2] = "Warmup";
    SessionState[SessionState["ParadeLaps"] = 3] = "ParadeLaps";
    SessionState[SessionState["Racing"] = 4] = "Racing";
    SessionState[SessionState["Checkered"] = 5] = "Checkered";
    SessionState[SessionState["CoolDown"] = 6] = "CoolDown";
})(SessionState || (SessionState = {}));
export var SessionFlags;
(function (SessionFlags) {
    SessionFlags[SessionFlags["None"] = 0] = "None";
    SessionFlags[SessionFlags["Checkered"] = 1] = "Checkered";
    SessionFlags[SessionFlags["White"] = 2] = "White";
    SessionFlags[SessionFlags["Green"] = 4] = "Green";
    SessionFlags[SessionFlags["Yellow"] = 8] = "Yellow";
    SessionFlags[SessionFlags["Red"] = 16] = "Red";
    SessionFlags[SessionFlags["Blue"] = 32] = "Blue";
    SessionFlags[SessionFlags["Debris"] = 64] = "Debris";
    SessionFlags[SessionFlags["Crossed"] = 128] = "Crossed";
    SessionFlags[SessionFlags["YellowWaving"] = 256] = "YellowWaving";
    SessionFlags[SessionFlags["OneLapToGreen"] = 512] = "OneLapToGreen";
    SessionFlags[SessionFlags["GreenHeld"] = 1024] = "GreenHeld";
    SessionFlags[SessionFlags["TenToGo"] = 2048] = "TenToGo";
    SessionFlags[SessionFlags["FiveToGo"] = 4096] = "FiveToGo";
    SessionFlags[SessionFlags["RandomWaving"] = 8192] = "RandomWaving";
    SessionFlags[SessionFlags["Caution"] = 16384] = "Caution";
    SessionFlags[SessionFlags["CautionWaving"] = 32768] = "CautionWaving";
})(SessionFlags || (SessionFlags = {}));
export var TrackSurface;
(function (TrackSurface) {
    TrackSurface[TrackSurface["NotInWorld"] = -1] = "NotInWorld";
    TrackSurface[TrackSurface["OffTrack"] = 0] = "OffTrack";
    TrackSurface[TrackSurface["InPitStall"] = 1] = "InPitStall";
    TrackSurface[TrackSurface["AproachingPits"] = 2] = "AproachingPits";
    TrackSurface[TrackSurface["OnTrack"] = 3] = "OnTrack";
})(TrackSurface || (TrackSurface = {}));
//# sourceMappingURL=telemetry.js.map