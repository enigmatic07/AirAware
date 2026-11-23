import React, { useState } from 'react';
import {
  Home,
  PlusCircle,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HackCard {
  id: string;
  title: string;
  category: 'diy_filter' | 'cleaning' | 'ventilation' | 'sealing' | 'plants';
  difficulty: 'Easy' | 'Moderate' | 'Quick Fix';
  estimatedCost: string;
  effectiveness: string;
  description: string;
  steps: string[];
  scientificPrinciple: string;
}

export const IndoorHacksView: React.FC = () => {
  const { logHabit } = useApp();
  const [loggedHackId, setLoggedHackId] = useState<string | null>(null);

  const hacks: HackCard[] = [
    {
      id: 'h-boxfan',
      title: 'Corsi-Rosenthal Minimal: DIY Box Fan HEPA Purifier',
      category: 'diy_filter',
      difficulty: 'Easy',
      estimatedCost: '₹1,500 – ₹2,200 ($18 – $26)',
      effectiveness: '70%–80% single-pass PM2.5 reduction',
      description: 'A scientifically validated, open-source air purifier that matches the clean air delivery rate (CADR) of commercial devices costing 5x more.',
      steps: [
        'Obtain a standard 20-inch box fan (or table fan with flat casing).',
        'Acquire a 20x20x1 inch MERV-13 or True HEPA replacement filter.',
        'Align the airflow arrow on the filter towards the fan blades (air is drawn in through the filter).',
        'Use duct tape or packaging tape to seal all 4 perimeter edges completely airtight.',
        'Run on Medium speed in the primary bedroom with windows shut.',
      ],
      scientificPrinciple: 'Creates negative pressure behind the fan blades, forcing room air through the dense electrostatic microfiber matrix.',
    },
    {
      id: 'h-wetmop',
      title: 'Wet-Mopping Protocol (Zero Dry Sweeping)',
      category: 'cleaning',
      difficulty: 'Quick Fix',
      estimatedCost: 'Free',
      effectiveness: 'Prevents 60% of indoor particulate re-suspension',
      description: 'Traditional brooms create electrostatic charges that launch settled toxic particles directly back into breathing height (1 to 1.5 meters).',
      steps: [
        'Never dry-sweep with grass or plastic brooms on high AQI days.',
        'Use a damp microfiber mop with warm water twice daily.',
        'Wipe surfaces, table tops, and computer screens with damp cloths.',
        'Wash floor mats weekly outside of living areas.',
      ],
      scientificPrinciple: 'Water molecules bind to fine dust and black carbon, eliminating mechanical agitation into respiratory zones.',
    },
    {
      id: 'h-sealing',
      title: 'Damp-Towel Draft & Threshold Sealing',
      category: 'sealing',
      difficulty: 'Quick Fix',
      estimatedCost: '₹100 ($1.20) or Free',
      effectiveness: 'Reduces outdoor PM infiltration by 40%',
      description: 'Air leakage beneath exterior doors and window sills is the primary source of indoor AQI deterioration in apartments.',
      steps: [
        'Roll old damp towels or cotton sheets tightly into tubes.',
        'Place firmly along the bottom gap of all exterior entrance doors and balcony sliders.',
        'Use paper masking tape along window frame gaps to block draft cracks without damaging wall paint.',
      ],
      scientificPrinciple: 'Damp cotton fibers create a tortuous labyrinth that physically impedes convective draft infiltration.',
    },
    {
      id: 'h-exhaust',
      title: 'Kitchen Exhaust & Frying Protocols',
      category: 'ventilation',
      difficulty: 'Easy',
      estimatedCost: 'Free',
      effectiveness: 'Prevents indoor PM2.5 spikes up to 800 µg/m³',
      description: 'Deep frying, searing with high-temperature oil, and incense sticks generate massive indoor PM2.5 surges that exceed outdoor smog.',
      steps: [
        'Turn on kitchen exhaust chimneys or range hoods 2 minutes BEFORE cooking begins.',
        'Close the kitchen door to isolate cooking fumes from bedrooms and living rooms.',
        'Avoid burning incense (agarbatti), dhoop, or scented candles during winter smog.',
      ],
      scientificPrinciple: 'Thermal updrafts from hot cooking oil disperse ultrafine acrolein and polycyclic aromatic hydrocarbons (PAHs).',
    },
    {
      id: 'h-plants',
      title: 'Indoor Plants Reality Check & Placement',
      category: 'plants',
      difficulty: 'Moderate',
      estimatedCost: '₹300 – ₹800 ($4 – $10)',
      effectiveness: 'High for VOCs & CO2, Low for PM2.5',
      description: 'Plants like Snake Plant (Sansevieria) and Areca Palm improve oxygen and absorb gaseous toxins, but cannot replace mechanical HEPA filtration for particulate smog.',
      steps: [
        'Place Snake Plants in bedrooms (they release oxygen at night via CAM photosynthesis).',
        'Wipe dust off plant leaves weekly so stomata remain open for gas exchange.',
        'Do not overwater—damp soil in closed rooms can cultivate fungal mold spores.',
      ],
      scientificPrinciple: 'Crassulacean Acid Metabolism (CAM) allows nocturnal carbon dioxide fixation without opening stomata during dry daylight.',
    },
  ];

  const handleLogHack = (hack: HackCard) => {
    logHabit({
      category: 'indoor_purification',
      title: hack.title,
      description: `Implemented indoor clean air hack: ${hack.title}`,
      co2SavedGrams: 0,
      pmExposureAvoidedUg: 240,
      cleanAirMinutes: 180,
    });
    setLoggedHackId(hack.id);
    setTimeout(() => setLoggedHackId(null), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Indoor Air Quality Sanctuary Hacks</h2>
            <p className="text-xs text-slate-400">
              Low-cost, scientifically verified methods to maintain indoor PM2.5 below 25 µg/m³
            </p>
          </div>
        </div>
      </div>

      {/* DIY Purifier Spotlight Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-950 border border-teal-500/30 p-6 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
            Community Spotlight Hack
          </span>
          <h3 className="text-xl font-black text-white mt-2">
            The Corsi-Rosenthal DIY Air Purifier
          </h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Commercial air purifiers often cost ₹10,000 to ₹30,000 and sell out during winter smog spikes. A standard home box fan + MERV-13 filter achieves comparable filtration for under ₹2,000.
          </p>
        </div>
      </div>

      {/* Hacks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hacks.map((hack) => {
          const isRecentlyLogged = loggedHackId === hack.id;

          return (
            <div
              key={hack.id}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-white">{hack.title}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 whitespace-nowrap">
                    {hack.difficulty}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                  <span>Cost: <strong className="text-slate-200">{hack.estimatedCost}</strong></span>
                  <span>•</span>
                  <span>Impact: <strong className="text-teal-400">{hack.effectiveness}</strong></span>
                </div>

                <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                  {hack.description}
                </p>

                {/* Steps List */}
                <div className="mt-3 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Step-by-Step Instructions:
                  </span>
                  <ul className="space-y-1.5">
                    {hack.steps.map((step, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Scientific Principle */}
                <div className="mt-3 text-[11px] text-slate-500 italic">
                  <strong>Scientific Principle:</strong> {hack.scientificPrinciple}
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Add to your clean air streak</span>
                <button
                  onClick={() => handleLogHack(hack)}
                  disabled={isRecentlyLogged}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isRecentlyLogged
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {isRecentlyLogged ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Logged to Impact Tracker!</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5 text-teal-400" />
                      <span>Log this Action</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
