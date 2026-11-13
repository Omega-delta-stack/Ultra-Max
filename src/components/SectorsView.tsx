import React from 'react';
import { Category, LinkItem } from '../types/flux';
import { Cpu, Telescope, Dna, Shield, Atom, Globe, ArrowRight } from 'lucide-react';

interface SectorsViewProps {
  categories: Category[];
  links: LinkItem[];
  onSelectCategory: (categoryId: string) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  Cpu: <Cpu className="w-5 h-5" />,
  Telescope: <Telescope className="w-5 h-5" />,
  Dna: <Dna className="w-5 h-5" />,
  Shield: <Shield className="w-5 h-5" />,
  Atom: <Atom className="w-5 h-5" />,
  Globe: <Globe className="w-5 h-5" />,
};

export const SectorsView: React.FC<SectorsViewProps> = ({
  categories,
  links,
  onSelectCategory,
}) => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono tracking-widest text-purple-400 uppercase mb-1">
          DOMAIN ARCHITECTURE
        </div>
        <h2 className="font-orbitron font-bold text-2xl sm:text-3xl text-white tracking-wide">
          Cosmic Flux Sectors
        </h2>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl font-light">
          Each sector represents a specialized domain of classified knowledge, quantum computation,
          or observational physics curated within the ULTRA MEGA FLUX repository.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat) => {
          const catLinks = links.filter((l) => l.categoryId === cat.id);
          const icon = iconMap[cat.icon] || <Cpu className="w-5 h-5" />;

          return (
            <div
              key={cat.id}
              className="glass-panel rounded-2xl p-6 border border-white/10 hover:border-purple-500/40 transition-all flex flex-col justify-between group hover:-translate-y-0.5"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  {icon}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <span>Sector {cat.order}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{catLinks.length} Portals</span>
                </div>

                <h3 className="font-syne font-bold text-lg text-white group-hover:text-purple-300 transition-colors mb-2">
                  {cat.name}
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed font-light mb-6">
                  {cat.description}
                </p>
              </div>

              <button
                onClick={() => onSelectCategory(cat.id)}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors flex items-center justify-between group/btn cursor-pointer"
              >
                <span>View {catLinks.length} Sector Links</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform text-cyan-400" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
