import React from "react";
import { Link } from "react-router-dom";

interface SafeSpaceBrandHeaderProps {
  title: string;
  subtitle?: string;
}

export const SafeSpaceBrandHeader: React.FC<SafeSpaceBrandHeaderProps> = ({
  title,
  subtitle,
}) => {
  return (
    <div className="text-center space-y-2 mb-6">
      <Link to="/" className="inline-flex items-center space-x-2 group focus:outline-none">
        <div className="w-10 h-10 rounded-2xl bg-botanical-700 text-ivory-100 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
          <svg className="w-6 h-6 fill-current text-ivory-100" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-3.84 2.71-7.05 6.35-7.81.33.68.83 1.28 1.47 1.73-1.78 1.15-2.82 3.19-2.82 5.38 0 3.31 2.69 6 6 6s6-2.69 6-6c0-2.19-1.04-4.23-2.82-5.38.64-.45 1.14-1.05 1.47-1.73C19.29 4.95 22 8.16 22 12c0 4.41-3.59 8-8 8z" />
          </svg>
        </div>
        <span className="font-display text-2xl font-bold text-charcoal tracking-tight">
          SafeSpace
          <span className="w-2 h-2 rounded-full bg-coral-500 ml-1 inline-block" />
        </span>
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-charcoal tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-charcoal/70 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

export default SafeSpaceBrandHeader;
