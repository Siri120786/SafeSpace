"""
Registry of the six condition modules and their module-specific features.

Shared features (Journaling, Routines, Stories, Emergency) are deliberately
NOT listed here — see app/features/ for those. Keeping the two separate
matches the architecture spec's rule: don't duplicate a shared feature's
logic inside a condition module, just reference it.
"""

CONDITION_MODULES = {
    "autism": {
        "status": "prototype",  # only module with a full PRD + working build so far
        "features": [
            "visual_schedules",
            "routine_planner",
            "emotion_cards",
            "low_sensory_mode",
            "social_stories",
            "reminders",
        ],
        "differentiators": [
            "co_regulation_mode",
            "interest_theming",
            "aac_lite_board",
            "transition_timer",
            "co_design_process",
        ],
    },
    "adhd": {
        "status": "feature_list",
        "features": ["focus_timer", "pomodoro", "task_breakdown", "habit_tracker", "reminders", "reward_system"],
    },
    "anxiety": {
        "status": "feature_list",
        "features": ["breathing", "grounding", "guided_meditation", "mood_tracker"],
    },
    "depression": {
        "status": "feature_list",
        "features": ["daily_checkins", "small_goals", "positive_reinforcement", "hobby_suggestions"],
    },
    "ptsd": {
        "status": "feature_list",
        "features": ["grounding", "safe_space_mode", "relaxation_audio"],
    },
    "pcos_pcod": {
        "status": "feature_list",
        "features": ["medication_reminders", "water_tracking", "gentle_exercise", "sleep_tracking", "stress_management"],
        "design_flag": "Needs deliberate body-image-sensitive design — see docs/Architecture_Specification.md section 8, item 5.",
    },
}
