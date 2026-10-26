import React from "react";
import { ProfileScreen } from "../features/profile";
import { SceneBackdrop } from "../features/landing/hero/SceneBackdrop";

export const ProfilePage: React.FC = () => {
  return (
    <div className="min-h-screen relative isolate">
      <SceneBackdrop soft />
      <ProfileScreen />
    </div>
  );
};

export default ProfilePage;
