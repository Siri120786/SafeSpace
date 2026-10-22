import React, { useState } from "react";
import {
  BigButton,
  CountdownDisplay,
  DeviceOnlyNote,
  EmptyState,
  ErrorState,
  LoadingState,
  ProgressBar,
  SoftBadge,
  WellnessCard,
  useReducedMotion,
} from "../wellness-ui";

export interface PreviewTab {
  id: string;
  label: string;
  description: string;
  component: React.ComponentType;
}

const WellnessGalleryTab: React.FC = () => {
  const { reducedMotion } = useReducedMotion();
  const [clickCount, setClickCount] = useState(0);
  const [progress, setProgress] = useState(45);
  const [countdownSeconds, setCountdownSeconds] = useState(270);
  const [retryNoticed, setRetryNoticed] = useState(false);

  return (
    <div className="space-y-10 text-left font-sans">
      {/* 1. Device-Only Privacy Notice */}
      <section className="space-y-3">
        <h4 className="font-display text-lg font-medium text-textHeading border-b border-olive-100 pb-2">
          1. Device-Only Privacy Notice (DeviceOnlyNote)
        </h4>
        <div className="space-y-3">
          <DeviceOnlyNote featureName="Focus Zone" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-textMuted">Compact version:</span>
            <DeviceOnlyNote compact />
          </div>
        </div>
      </section>

      {/* 2. BigButtons (48px+ targets) */}
      <section className="space-y-3">
        <h4 className="font-display text-lg font-medium text-textHeading border-b border-olive-100 pb-2">
          2. Generous Touch Targets (BigButton &gt;= 48px)
        </h4>
        <p className="text-xs text-textMuted">
          Accessible touch targets with visible keyboard focus rings.
        </p>
        <div className="flex flex-wrap gap-3">
          <BigButton
            variant="primary"
            onClick={() => setClickCount((c) => c + 1)}
          >
            Primary Action ({clickCount})
          </BigButton>
          <BigButton
            variant="secondary"
            icon={<span>🌱</span>}
            onClick={() => setClickCount((c) => c + 1)}
          >
            Secondary
          </BigButton>
          <BigButton variant="gentle" onClick={() => setClickCount((c) => c + 1)}>
            Gentle Choice
          </BigButton>
          <BigButton variant="ghost" onClick={() => setClickCount((c) => c + 1)}>
            Ghost Button
          </BigButton>
          <BigButton variant="primary" disabled>
            Disabled Button
          </BigButton>
        </div>
      </section>

      {/* 3. Soft Badges */}
      <section className="space-y-3">
        <h4 className="font-display text-lg font-medium text-textHeading border-b border-olive-100 pb-2">
          3. Gentle Status Pills (SoftBadge)
        </h4>
        <div className="flex flex-wrap gap-2.5 items-center">
          <SoftBadge variant="default">Default Calm</SoftBadge>
          <SoftBadge variant="success" icon="✓">
            Step Completed
          </SoftBadge>
          <SoftBadge variant="warm" icon="☀️">
            Morning Routine
          </SoftBadge>
          <SoftBadge variant="info" icon="🌊">
            Sensory Reset
          </SoftBadge>
          <SoftBadge variant="neutral">On Device</SoftBadge>
          <SoftBadge size="md" variant="success" icon="🌿">
            Medium Size
          </SoftBadge>
        </div>
      </section>

      {/* 4. Progress Bar */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-olive-100 pb-2">
          <h4 className="font-display text-lg font-medium text-textHeading">
            4. Accessible Progress Bar (ProgressBar)
          </h4>
          <div className="flex gap-2">
            <button
              onClick={() => setProgress((p) => Math.max(0, p - 15))}
              className="px-2 py-1 bg-white border border-olive-200 rounded text-xs"
            >
              -15%
            </button>
            <button
              onClick={() => setProgress((p) => Math.min(100, p + 15))}
              className="px-2 py-1 bg-white border border-olive-200 rounded text-xs"
            >
              +15%
            </button>
          </div>
        </div>
        <p className="text-xs text-textMuted">
          Current Motion Setting:{" "}
          <strong className="text-deepGreen">
            {reducedMotion ? "Reduced (Transitions Off)" : "Standard (Smooth Transition)"}
          </strong>
        </p>
        <ProgressBar
          value={progress}
          label="Routine completion"
          showValue
          variant="olive"
        />
        <ProgressBar
          value={progress}
          label="Forced reduced motion test"
          showValue
          variant="deepGreen"
          reducedMotion={true}
        />
      </section>

      {/* 5. Countdown Display */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-olive-100 pb-2">
          <h4 className="font-display text-lg font-medium text-textHeading">
            5. Text-First Timer (CountdownDisplay)
          </h4>
          <div className="flex gap-2">
            <button
              onClick={() => setCountdownSeconds((s) => Math.max(0, s - 30))}
              className="px-2 py-1 bg-white border border-olive-200 rounded text-xs"
            >
              -30s
            </button>
            <button
              onClick={() => setCountdownSeconds((s) => s + 30)}
              className="px-2 py-1 bg-white border border-olive-200 rounded text-xs"
            >
              +30s
            </button>
          </div>
        </div>
        <div className="p-6 bg-white rounded-3xl border border-olive-100 shadow-card">
          <CountdownDisplay
            secondsRemaining={countdownSeconds}
            label="Focus Interval"
          />
        </div>
      </section>

      {/* 6. Wellness Cards */}
      <section className="space-y-3">
        <h4 className="font-display text-lg font-medium text-textHeading border-b border-olive-100 pb-2">
          6. Calming Containers (WellnessCard)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WellnessCard
            title="Morning Sensory Prep"
            subtitle="Take a quiet moment before morning tasks."
            badge={<SoftBadge variant="warm">Autism Support</SoftBadge>}
          >
            <p className="text-xs text-textBody">
              Steps are structured sequentially with no flashing timers.
            </p>
          </WellnessCard>

          <WellnessCard
            title="Interactive Clickable Card"
            subtitle="Click or press Enter/Space."
            badge={<SoftBadge variant="info">Keyboard Focus</SoftBadge>}
            onClick={() => setClickCount((c) => c + 1)}
          >
            <p className="text-xs text-textBody">Total activations: {clickCount}</p>
          </WellnessCard>

          <WellnessCard
            title="Opt-in Decorative Card"
            subtitle="Disappears under simplified presentation."
            dataDecorative={true}
            variant="accent"
          >
            <p className="text-xs text-textMuted">
              This card has data-decorative=&quot;true&quot;. Toggle Simplified Mode to verify it hides.
            </p>
          </WellnessCard>

          <WellnessCard
            title="Subtle Variant"
            variant="subtle"
            subtitle="Gentle background with minimal border contrast."
          >
            <p className="text-xs text-textBody">Soft and easy on the eyes.</p>
          </WellnessCard>
        </div>
      </section>

      {/* 7. Empty State */}
      <section className="space-y-3">
        <h4 className="font-display text-lg font-medium text-textHeading border-b border-olive-100 pb-2">
          7. Reassuring Empty State (EmptyState)
        </h4>
        <EmptyState
          title="No tasks scheduled for now"
          description="Everything is clear. You can take a gentle break or add a new routine step whenever you feel ready."
          icon="🌸"
          action={{
            label: "Create a gentle step",
            onClick: () => {},
          }}
        />
      </section>

      {/* 8. Error State */}
      <section className="space-y-3">
        <h4 className="font-display text-lg font-medium text-textHeading border-b border-olive-100 pb-2">
          8. Non-Clinical Error Alert (ErrorState)
        </h4>
        <ErrorState
          title="Take a breath"
          message="We could not load your stored routine settings right now. Your device data is safe."
          onRetry={() => setRetryNoticed(true)}
          retryLabel={retryNoticed ? "Checked! All safe ✓" : "Try again"}
        />
      </section>

      {/* 9. Loading State */}
      <section className="space-y-3">
        <h4 className="font-display text-lg font-medium text-textHeading border-b border-olive-100 pb-2">
          9. Peaceful Loading (LoadingState)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-olive-100">
            <p className="text-xs font-semibold text-textMuted pt-3 px-4">
              Current setting:
            </p>
            <LoadingState message="Preparing your safe space..." />
          </div>
          <div className="bg-white rounded-2xl border border-olive-100">
            <p className="text-xs font-semibold text-textMuted pt-3 px-4">
              Forced reduced motion (Static Icon):
            </p>
            <LoadingState
              message="Quietly ready without animations..."
              reducedMotion={true}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export const PREVIEW_REGISTRY: PreviewTab[] = [
  {
    id: "wellness-ui",
    label: "Wellness UI Gallery",
    description: "Accessible, low-sensory design system primitives and device-only indicator.",
    component: WellnessGalleryTab,
  },
];
