import React from "react";

interface EntryChoiceCardProps {
  onChooseCaregiver: () => void;
  onChooseChild: () => void;
}

export const EntryChoiceCard: React.FC<EntryChoiceCardProps> = ({
  onChooseCaregiver,
  onChooseChild,
}) => {
  return (
    <section id="entry-cards" className="py-12 bg-ivory-100/60 border-y border-botanical-900/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-charcoal tracking-tight">
            How would you like to enter?
          </h2>
          <p className="text-sm text-charcoal/70 mt-2">
            Select your entry path below to continue to your tailored environment.
          </p>
        </div>

        {/* 2-Column Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* Card 1: Adult / Caregiver */}
          <div
            onClick={onChooseCaregiver}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChooseCaregiver();
              }
            }}
            className="group bg-white rounded-[32px] p-8 border border-botanical-900/10 shadow-sm hover:shadow-md hover:border-botanical-600/40 transition-all cursor-pointer flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-botanical-700"
          >
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-coral-100 text-coral-600 flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                  {/* Adult / User Icon */}
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-coral-50 text-coral-600 border border-coral-200">
                  Caregiver &amp; Individual
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="font-display text-2xl font-bold text-charcoal group-hover:text-botanical-700 transition-colors">
                I&apos;m an adult
              </h3>
              <p className="text-sm text-charcoal/70 mt-2 leading-relaxed">
                Sign in as an Individual or a Caregiver.
              </p>
            </div>

            {/* CTA Button */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">
                Full Account Portal
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChooseCaregiver();
                }}
                className="px-6 py-3 bg-botanical-700 group-hover:bg-botanical-800 text-white font-bold text-sm rounded-full shadow-sm transition-colors"
              >
                Log in &rarr;
              </button>
            </div>
          </div>

          {/* Card 2: Child */}
          <div
            onClick={onChooseChild}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChooseChild();
              }
            }}
            className="group bg-white rounded-[32px] p-8 border border-botanical-900/10 shadow-sm hover:shadow-md hover:border-botanical-600/40 transition-all cursor-pointer flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-botanical-700"
          >
            <div>
              {/* Badge & Icon */}
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-botanical-100 text-botanical-700 flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                  {/* Key / PIN Icon */}
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1-1-1 1-1-1-1 1-1-1H3v-3.257L8.257 8.243A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-botanical-50 text-botanical-700 border border-botanical-200">
                  Child PIN Access
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="font-display text-2xl font-bold text-charcoal group-hover:text-botanical-700 transition-colors">
                I&apos;m a child
              </h3>
              <p className="text-sm text-charcoal/70 mt-2 leading-relaxed">
                Enter your SafeSpace using your family code and PIN.
              </p>
            </div>

            {/* CTA Button */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">
                Instant Child Space
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChooseChild();
                }}
                className="px-6 py-3 bg-botanical-100 group-hover:bg-botanical-200 text-botanical-800 font-bold text-sm rounded-full transition-colors"
              >
                Enter my space &rarr;
              </button>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};

export default EntryChoiceCard;
