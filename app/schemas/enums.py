from typing import Literal

LineCategory = Literal["A", "B", "C", "D", "E", "DFC", "suburban"]
TrafficDensityClass = Literal["A", "B", "C", "D", "E"]

Department = Literal[
    "P.Way",
    "S&T",
    "TRD",
    "Works",
    "Bridge",
    "Mechanical",
    "Operating",
]

DefectSeverity = Literal["critical", "major", "minor", "observational"]
DefectStatus = Literal["open", "acknowledged", "in_progress", "deferred", "closed"]

PreferredShift = Literal["day", "night", "any"]
TaskStatus = Literal[
    "pending",
    "scored",
    "scheduled",
    "in_progress",
    "completed",
    "cancelled",
]

BlockType = Literal["absolute", "caution", "power"]
BlockTypeAllowed = Literal["absolute", "caution", "power", "any"]
FreightTrafficLevel = Literal["low", "medium", "high", "very_high"]
BlockStatus = Literal["draft", "planned", "approved", "in_progress", "completed", "cancelled"]
