import React from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  onChooseCaregiver?: () => void;
  onChooseChild?: () => void;
}

export default function RoleChoicePage({ onChooseCaregiver, onChooseChild }: Props) {
  const navigate = useNavigate();

  const handleCaregiver = () => {
    if (onChooseCaregiver) {
      onChooseCaregiver();
    } else {
      navigate("/login");
    }
  };

  const handleChild = () => {
    if (onChooseChild) {
      onChooseChild();
    } else {
      navigate("/child/pin");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-center text-slate-800">Welcome to SafeSpace</h1>
        <p className="text-center text-slate-600 text-sm mt-2 mb-6">
          Who is opening the app today?
        </p>
        
        <div className="space-y-4">
          <button
            className="w-full p-4 text-left border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-xl transition group"
            onClick={handleCaregiver}
          >
            <div className="font-bold text-slate-800 group-hover:text-indigo-600">
              I am a Caregiver / Parent
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Sign up or sign in to manage family profiles and settings
            </div>
          </button>

          <button
            className="w-full p-4 text-left border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 rounded-xl transition group"
            onClick={handleChild}
          >
            <div className="font-bold text-slate-800 group-hover:text-teal-600">
              I am a Child
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Enter your family code and PIN to open your space
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
