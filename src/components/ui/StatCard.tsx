import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  tone?: 'brand' | 'amber' | 'emerald' | 'stone' | 'blue';
}

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = 'brand',
}: StatCardProps) {
  const toneStyles = {
    brand: 'bg-brand-50 text-brand-800 border-brand-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    stone: 'bg-stone-100 text-stone-800 border-stone-200',
    blue: 'bg-sky-50 text-sky-800 border-sky-100',
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs hover:border-stone-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1.5">
            {value}
          </p>
          {sublabel && (
            <p className="text-xs text-stone-500 mt-1">{sublabel}</p>
          )}
        </div>
        <div
          className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${toneStyles[tone]}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
