"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Save,
  ShieldAlert,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import { useNutriCoach } from "./NutriCoachContext";
import {
  DEFAULT_CHATBOT_PREFERENCES,
  type ChatbotPreferences,
  type CommunicationStyle,
  type EncouragementLevel,
  type ResponseDetail,
  type ChatLanguagePreference,
} from "@/lib/types";

export function MemberProfileView() {
  const { activeProfile, activeTargets, updateChatbotPreferences } = useNutriCoach();

  // Local preferences state initialized from activeProfile or defaults
  const [preferences, setPreferences] = useState<ChatbotPreferences>(() => {
    return activeProfile.chatbot_preferences || DEFAULT_CHATBOT_PREFERENCES;
  });

  const [preferredNameInput, setPreferredNameInput] = useState<string>(
    activeProfile.chatbot_preferences?.preferred_name || ""
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync when activeProfile changes (e.g. member switch or external load)
  useEffect(() => {
    const current = activeProfile.chatbot_preferences || DEFAULT_CHATBOT_PREFERENCES;
    setPreferences(current);
    setPreferredNameInput(current.preferred_name || "");
  }, [activeProfile.id, activeProfile.chatbot_preferences]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    const payload: ChatbotPreferences = {
      ...preferences,
      preferred_name: preferredNameInput.trim() || null,
    };

    const result = await updateChatbotPreferences(payload);
    setIsSaving(false);

    if (result.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } else {
      setSaveError(result.error || "Failed to persist preferences.");
    }
  };

  const getGoalBadgeText = () => {
    if (activeProfile.target_delta && activeProfile.target_delta > 0) {
      if (activeProfile.goal?.toLowerCase().includes("fat loss")) {
        return `Lose ${activeProfile.target_delta} ${activeProfile.target_unit === "% body fat" ? "% body fat" : "kg"}`;
      }
      if (activeProfile.goal?.toLowerCase().includes("bulking") || activeProfile.goal?.toLowerCase().includes("gain weight")) {
        return `Gain +${activeProfile.target_delta} ${activeProfile.target_unit === "% body fat" ? "% mass" : "kg Mass"}`;
      }
      if (activeProfile.goal?.toLowerCase().includes("muscle")) {
        return `Gain +${activeProfile.target_delta} ${activeProfile.target_unit === "% body fat" ? "% muscle" : "kg Muscle"}`;
      }
      return `Target: ±${activeProfile.target_delta} ${activeProfile.target_unit || "kg"}`;
    }
    return activeProfile.goal || "Healthy Maintenance";
  };

  return (
    <div className="space-y-6">
      {/* Profile Overview Card */}
      <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-tint text-brand flex items-center justify-center font-bold text-base">
              {activeProfile.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-primary">{activeProfile.name}</h3>
              <p className="text-xs text-ink-muted">
                {activeProfile.email} · {activeProfile.sex} · {activeProfile.age} yrs · {activeProfile.height} cm · {activeProfile.weight} kg
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-brand-tint text-brand border border-[#D5E6D2] flex items-center gap-1">
              <span>🎯 Goal:</span>
              <span>{getGoalBadgeText()}</span>
            </span>

            {activeProfile.allergies && activeProfile.allergies.map((allergy) => (
              <span
                key={allergy}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#FEF2F2] text-status-danger border border-[#FCA5A5] flex items-center gap-1"
              >
                <span>⚠️ Allergy:</span>
                <span>{allergy}</span>
              </span>
            ))}

            {activeProfile.disliked_foods && activeProfile.disliked_foods.map((food) => (
              <span
                key={food}
                className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-surface-subtle text-ink-secondary border border-border flex items-center gap-1"
              >
                <span>🚫 Excludes:</span>
                <span>{food.replace(/^no\s+/i, "")}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Quantitative Goal Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-surface-subtle p-3.5 rounded-lg border border-border">
          <div>
            <span className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1">Primary Nutrition Goal</span>
            <div className="font-semibold text-xs text-ink-primary">{activeProfile.goal || "Fat Loss & Tone"}</div>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1">Quantitative Target</span>
            <div className="font-semibold text-xs text-brand flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              <span>
                {activeProfile.target_delta && activeProfile.target_delta > 0
                  ? `${activeProfile.target_delta} ${activeProfile.target_unit || "kg"}`
                  : "Maintenance (0 kg delta)"}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1">Activity Level</span>
            <div className="font-semibold text-xs text-ink-primary capitalize">{activeProfile.activity_level || "Moderate (3-5 sessions/wk)"}</div>
          </div>
        </div>

        {/* Dietary Restrictions & Allergy Guardrails */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
          {/* Allergies Card */}
          <div className="border border-[#FCA5A5]/80 bg-gradient-to-br from-[#FEF2F2]/50 to-surface p-3.5 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-status-danger text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Allergies & Intolerances (Guardrails)</span>
              </span>
              <span className="text-[10px] text-status-danger font-medium">Strictly Filtered</span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeProfile.allergies && activeProfile.allergies.length > 0 ? (
                activeProfile.allergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded bg-[#FEF2F2] text-status-danger border border-[#FCA5A5]"
                  >
                    ⚠️ {allergy}
                  </span>
                ))
              ) : (
                <span className="text-ink-muted text-xs">No known allergies reported</span>
              )}
            </div>
          </div>

          {/* Exclusions & Preferences Card */}
          <div className="border border-border bg-surface-subtle p-3.5 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink-primary text-xs flex items-center gap-1.5">
                <span>🚫 Excluded Foods & Preferences</span>
              </span>
              <span className="text-[10px] text-ink-muted font-medium">Excluded in Planner</span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeProfile.disliked_foods && activeProfile.disliked_foods.length > 0 ? (
                activeProfile.disliked_foods.map((item) => (
                  <span
                    key={item}
                    className="text-[11px] font-medium px-2.5 py-1 rounded bg-surface text-ink-secondary border border-border"
                  >
                    🚫 {item.replace(/^no\s+/i, "")}
                  </span>
                ))
              ) : (
                <span className="text-ink-muted text-xs">No excluded ingredients</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Target Breakdown */}
      <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h4 className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span>Prescribed Daily Nutrition Targets</span>
          </h4>
          <span className="text-[11px] text-brand font-medium">Coach Verified · Calibrated</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="bg-surface-subtle p-3.5 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted font-medium">Energy</div>
            <div className="text-lg font-bold text-ink-primary mt-0.5">{activeTargets.calories}</div>
            <div className="text-[10px] text-ink-muted">kcal / day</div>
          </div>

          <div className="bg-surface-subtle p-3.5 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted font-medium">Protein</div>
            <div className="text-lg font-bold text-brand mt-0.5">{activeTargets.protein}g</div>
            <div className="text-[10px] text-ink-muted">{Math.round((activeTargets.protein * 4 / activeTargets.calories) * 100)}% calories</div>
          </div>

          <div className="bg-surface-subtle p-3.5 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted font-medium">Carbohydrates</div>
            <div className="text-lg font-bold text-ink-primary mt-0.5">{activeTargets.carbs}g</div>
            <div className="text-[10px] text-ink-muted">{Math.round((activeTargets.carbs * 4 / activeTargets.calories) * 100)}% calories</div>
          </div>

          <div className="bg-surface-subtle p-3.5 rounded-md border border-border">
            <div className="text-[11px] text-ink-muted font-medium">Fats</div>
            <div className="text-lg font-bold text-ink-primary mt-0.5">{activeTargets.fat}g</div>
            <div className="text-[10px] text-ink-muted">{Math.round((activeTargets.fat * 9 / activeTargets.calories) * 100)}% calories</div>
          </div>
        </div>
      </div>

      {/* Chatbot Preferences Section */}
      <div className="bg-surface rounded-lg border border-border p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brand-tint text-brand flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-ink-primary">Chatbot Communication Preferences</h4>
              <p className="text-[11px] text-ink-muted">Tailor the assistant tone, encouragement level, response detail, and name</p>
            </div>
          </div>
          <span className="text-[10px] text-brand font-medium bg-brand-tint/60 px-2 py-0.5 rounded border border-[#D5E6D2]">
            Personalized Coaching
          </span>
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Preferred Name */}
            <div className="space-y-1.5">
              <label htmlFor="pref-name" className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-ink-muted" />
                <span>Preferred Name</span>
              </label>
              <input
                id="pref-name"
                type="text"
                value={preferredNameInput}
                onChange={(e) => setPreferredNameInput(e.target.value)}
                placeholder={`Defaults to profile name (${activeProfile.name.split(" ")[0]})`}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors"
                maxLength={40}
              />
              <p className="text-[10px] text-ink-muted">
                Used in greetings. Leave blank to default naturally to &ldquo;{activeProfile.name.split(" ")[0]}&rdquo;.
              </p>
            </div>

            {/* Communication Style */}
            <div className="space-y-1.5">
              <label htmlFor="pref-style" className="text-xs font-semibold text-ink-primary block">
                Communication Style
              </label>
              <select
                id="pref-style"
                value={preferences.communication_style}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    communication_style: e.target.value as CommunicationStyle,
                  }))
                }
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors cursor-pointer"
              >
                <option value="professional_supportive">Professional and supportive (Default)</option>
                <option value="friendly_conversational">Friendly and conversational</option>
                <option value="direct_concise">Direct and concise</option>
                <option value="detailed_educational">Detailed and educational</option>
              </select>
              <p className="text-[10px] text-ink-muted">
                Governs the general tone and structure across coaching replies.
              </p>
            </div>

            {/* Encouragement Level */}
            <div className="space-y-1.5">
              <label htmlFor="pref-encouragement" className="text-xs font-semibold text-ink-primary block">
                Encouragement Level
              </label>
              <select
                id="pref-encouragement"
                value={preferences.encouragement_level}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    encouragement_level: e.target.value as EncouragementLevel,
                  }))
                }
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors cursor-pointer"
              >
                <option value="balanced">Balanced encouragement (Default)</option>
                <option value="gentle">Gentle encouragement</option>
                <option value="minimal">Minimal encouragement</option>
              </select>
              <p className="text-[10px] text-ink-muted">
                Controls coaching reinforcement and motivational feedback on progress and setbacks.
              </p>
            </div>

            {/* Response Detail */}
            <div className="space-y-1.5">
              <label htmlFor="pref-detail" className="text-xs font-semibold text-ink-primary block">
                Response Detail
              </label>
              <select
                id="pref-detail"
                value={preferences.response_detail}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    response_detail: e.target.value as ResponseDetail,
                  }))
                }
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors cursor-pointer"
              >
                <option value="standard">Standard (Default)</option>
                <option value="concise">Concise</option>
                <option value="detailed">Detailed</option>
              </select>
              <p className="text-[10px] text-ink-muted">
                Adjusts standard explanation length and scientific depth.
              </p>
            </div>

            {/* Language */}
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="pref-language" className="text-xs font-semibold text-ink-primary block">
                Language
              </label>
              <select
                id="pref-language"
                value={preferences.language}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    language: e.target.value as ChatLanguagePreference,
                  }))
                }
                className="w-full md:w-1/2 text-xs rounded-md border border-border bg-surface px-3 py-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors cursor-pointer"
              >
                <option value="auto">Follow message language automatically (Default)</option>
                <option value="en">Always English</option>
                <option value="ar">العربية (Arabic)</option>
              </select>
              <p className="text-[10px] text-ink-muted">
                Automatic language detection responds in Arabic or English according to the user message.
              </p>
            </div>
          </div>

          {/* Feedback states */}
          {saveSuccess && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-[#F0FDF4] border border-[#86EFAC] text-status-success text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-status-success" />
              <span>Chatbot preferences saved and applied to subsequent replies!</span>
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-[#FEF2F2] border border-[#FCA5A5] text-status-danger text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-status-danger" />
              <span>Failed to save preferences: {saveError}</span>
            </div>
          )}

          <div className="flex items-center justify-end pt-2 border-t border-border">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand text-surface hover:bg-brand-hover text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-hairline"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Preferences...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Preferences</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
