import React, { useState } from 'react';
import {
  X,
  Users,
  Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HouseholdMember, HealthCondition, UserHouseholdProfile } from '../../types/profile';

export const HouseholdProfileModal: React.FC = () => {
  const {
    householdProfile,
    updateHouseholdProfile,
    isProfileModalOpen,
    setIsProfileModalOpen,
  } = useApp();

  const [profile, setProfile] = useState<UserHouseholdProfile>(householdProfile);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAge, setNewMemberAge] = useState<number>(30);
  const [newMemberRelation, setNewMemberRelation] = useState<HouseholdMember['relation']>('self');
  const [newMemberConditions, setNewMemberConditions] = useState<HealthCondition[]>(['none']);

  if (!isProfileModalOpen) return null;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    const isVulnerable =
      newMemberAge < 5 ||
      newMemberAge >= 65 ||
      newMemberConditions.some((c) => c !== 'none');

    const newMember: HouseholdMember = {
      id: 'm-' + Date.now(),
      name: newMemberName.trim(),
      age: newMemberAge,
      relation: newMemberRelation,
      conditions: newMemberConditions,
      isVulnerable,
    };

    setProfile({
      ...profile,
      members: [...profile.members, newMember],
    });

    setNewMemberName('');
    setNewMemberAge(30);
    setNewMemberConditions(['none']);
  };

  const handleRemoveMember = (id: string) => {
    setProfile({
      ...profile,
      members: profile.members.filter((m) => m.id !== id),
    });
  };

  const handleSaveAll = () => {
    updateHouseholdProfile(profile);
    setIsProfileModalOpen(false);
  };

  const conditionOptions: { id: HealthCondition; label: string }[] = [
    { id: 'none', label: 'None (Healthy)' },
    { id: 'asthma', label: 'Asthma / Bronchitis' },
    { id: 'copd', label: 'COPD' },
    { id: 'cardiovascular', label: 'Cardiovascular / Heart Disease' },
    { id: 'pregnancy', label: 'Pregnancy' },
    { id: 'elderly', label: 'Senior (65+)' },
    { id: 'respiratory_allergy', label: 'Dust / Pollen Allergy' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Household Profile & Vulnerabilities</h3>
              <p className="text-xs text-slate-400">
                Powers Gemini AI's personalized health guidance and emergency warnings
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsProfileModalOpen(false)}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 mt-4 max-h-[70vh] overflow-y-auto pr-1">
          
          {/* Family Name */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Household / Family Name
            </label>
            <input
              type="text"
              value={profile.familyName}
              onChange={(e) => setProfile({ ...profile, familyName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Members List */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Family Members ({profile.members.length})
            </label>

            <div className="space-y-2 mb-4">
              {profile.members.map((member) => (
                <div
                  key={member.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{member.name}</span>
                      <span className="text-slate-400">({member.age} yrs, {member.relation})</span>
                      {member.isVulnerable && (
                        <span className="px-2 py-0.2 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                          Vulnerable
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Conditions: {member.conditions.join(', ')}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Member Subform */}
            <form onSubmit={handleAddMember} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3">
              <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider block">
                + Add Family Member
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <input
                  type="number"
                  placeholder="Age"
                  min="0"
                  max="110"
                  value={newMemberAge}
                  onChange={(e) => setNewMemberAge(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                />
                <select
                  value={newMemberRelation}
                  onChange={(e) => setNewMemberRelation(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="self">Self</option>
                  <option value="partner">Partner</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent / Senior</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Conditions checkboxes */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Health Conditions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {conditionOptions.map((opt) => {
                    const isSelected = newMemberConditions.includes(opt.id);
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => {
                          if (opt.id === 'none') {
                            setNewMemberConditions(['none']);
                          } else {
                            const filtered = newMemberConditions.filter((c) => c !== 'none');
                            if (isSelected) {
                              setNewMemberConditions(
                                filtered.length > 1 ? filtered.filter((c) => c !== opt.id) : ['none']
                              );
                            } else {
                              setNewMemberConditions([...filtered, opt.id]);
                            }
                          }
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-semibold'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold text-xs transition-colors"
              >
                Add Member to Household
              </button>
            </form>
          </div>

          {/* Home Setup */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-300 block">
              Home Clean Air Equipment
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.home.hasAirPurifier}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      home: { ...profile.home, hasAirPurifier: e.target.checked },
                    })
                  }
                  className="rounded text-teal-500 focus:ring-0"
                />
                <span className="text-slate-300">Owns HEPA Air Purifier</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.home.hasCookingExhaust}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      home: { ...profile.home, hasCookingExhaust: e.target.checked },
                    })
                  }
                  className="rounded text-teal-500 focus:ring-0"
                />
                <span className="text-slate-300">Kitchen Chimney / Exhaust Fan</span>
              </label>
            </div>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800 mt-6">
          <button
            onClick={() => setIsProfileModalOpen(false)}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20"
          >
            Save Household Profile
          </button>
        </div>

      </div>
    </div>
  );
};
