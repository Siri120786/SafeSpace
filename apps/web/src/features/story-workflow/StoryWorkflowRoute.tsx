import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useLowSensory } from "../calm-tools";
import { StoryWorkflow } from "./components/StoryWorkflow";

/** Mounted at /story-workflow inside a ProtectedRoute. */
export const StoryWorkflowRoute: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { lowSensory, preferenceError } = useLowSensory();
  const onExit = useCallback(() => navigate("/dashboard"), [navigate]);
  const isCaregiver = session?.kind === "auth_user" && session.profile.role === "caregiver";
  return <StoryWorkflow isCaregiver={isCaregiver} lowSensory={lowSensory} onExit={onExit} notice={preferenceError} />;
};
