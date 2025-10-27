
import React from 'react';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, icon, children }) => {
  return (
    <section className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 shadow-lg">
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0 bg-sky-500/10 text-sky-400 rounded-lg p-2 mr-4">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>
      <div className="text-slate-300 space-y-4 prose prose-invert prose-p:text-slate-300 prose-ul:text-slate-300">
        {children}
      </div>
    </section>
  );
};
