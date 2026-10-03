"use client";

import React, { useState } from "react";
import { ArrowUp, Check, ChevronRight, MessageSquare, Plus, Sparkles, Utensils } from "lucide-react";
import { addDays } from "@/lib/dates";
import { type AgentActionCard, useNutriCoach } from "./NutriCoachContext";

interface AssistantMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  actionCard?: AgentActionCard;
  pendingConfirmation?: {
    mealName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealType: string;
    targetDate: string;
    isExtraSnack?: boolean;
  };
  time: string;
}

export function AskNutriCoachPanel() {
  const { state, confirmAddMeal, replaceMealSlot, replaceMeal, logMeal, todayRemainingMacros, setActiveTab } = useNutriCoach();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [aiMessages, setAiMessages] = useState<AssistantMessage[]>([
    {
      id: "ai-init-1",
      sender: "agent",
      text: "Hello! I'm NutriCoach, your adaptive nutrition AI assistant. Ask me to adjust foods, calculate macros, or suggest Egyptian recipes.",
      time: "Online",
    },
  ]);

  const quickPrompts = [
    "I want Greek yogurt for breakfast",
    "I don't have chicken tonight",
    "Replace tomorrow's breakfast",
    "Create tomorrow's plan using Egyptian foods",
  ];

  const handleSend = async (promptText?: string) => {
    const text = promptText || input;
    if (!text.trim() || loading) return;

    const userMsg: AssistantMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text,
      time: "Just now",
    };

    setAiMessages((prev) => [...prev, userMsg]);
    if (!promptText) setInput("");
    setLoading(true);

    const p = text.toLowerCase();

    setTimeout(() => {
      let reply = "";
      let actionCard: AgentActionCard | undefined;
      let pendingConfirmation: AssistantMessage["pendingConfirmation"];

      if (p.includes("greek yogurt") || (p.includes("yogurt") && (p.includes("breakfast") || p.includes("morning")))) {
        const yogurtSnapshot = {
          meal_name: "Greek yogurt with mixed berries & chia seeds",
          calories: 340,
          protein: 24,
          carbs: 32,
          fat: 8,
          ingredients: ["greek yogurt", "blueberries", "strawberries", "chia seeds"],
          tags: ["breakfast", "high-protein", "dairy"],
        };
        replaceMealSlot({ mealType: "breakfast", meal: yogurtSnapshot, source: "agent" });
        reply = "I've updated your breakfast to Greek yogurt with mixed berries (340 kcal · 24g P · 32g C · 8g F). Your remaining dinner targets have been balanced accordingly.";
        actionCard = {
          type: "plan_updated",
          title: "Breakfast Updated",
          details: "Greek yogurt with mixed berries (340 kcal · 24g P)",
          actionLabel: "View Updated Plan",
          targetTab: "plan",
        };
      } else if (p.includes("pudding") || p.includes("chocolate") || p.includes("protein bar") || (p.includes("want") && p.includes("snack"))) {
        const foodName = p.includes("pudding") ? "Chocolate pudding" : p.includes("protein bar") ? "Protein Bar" : "Fruit & yogurt bowl";
        const cals = p.includes("pudding") ? 240 : 210;
        const prot = p.includes("pudding") ? 4 : 20;
        const carbs = p.includes("pudding") ? 38 : 22;
        const fat = p.includes("pudding") ? 8 : 5;

        reply = `Do you plan to have ${foodName} (${cals} kcal · ${prot}g P · ${carbs}g C · ${fat}g F) today or schedule it into tomorrow's plan?`;
        pendingConfirmation = {
          mealName: foodName,
          calories: cals,
          protein: prot,
          carbs,
          fat,
          mealType: "snack_2",
          targetDate: state.today,
          isExtraSnack: true,
        };
      } else if (p.includes("chicken") || p.includes("salmon") || p.includes("replace") || p.includes("don't have") || p.includes("dont have") || p.includes("no chicken")) {
        const avoid = p.includes("chicken") || p.includes("no chicken") || p.includes("don't have chicken") ? ["chicken"] : [];
        replaceMeal({ mealType: "dinner", avoid, reason: "Member ingredient preference" });
        reply = `I found 3 high-protein alternatives that fit your remaining targets without ${avoid.join(", ") || "chicken"}. You can preview and choose your favorite.`;
        actionCard = {
          type: "plan_updated",
          title: "Dinner Alternatives Ready",
          details: "3 high-protein options ready for selection",
          actionLabel: "Review Alternatives",
          targetTab: "today",
        };
      } else if (p.includes("egyptian") || p.includes("tomorrow")) {
        reply = `I've prepared tomorrow's plan featuring authentic Egyptian favorites (Ful & boiled eggs, grilled sea bass with brown rice, and molokhia) tailored to your daily calorie target.`;
        actionCard = {
          type: "plan_updated",
          title: "Tomorrow's Plan Ready",
          details: "Egyptian favorites aligned with macro goals",
          actionLabel: "View Weekly Plan",
          targetTab: "plan",
        };
      } else if (p.includes("ate") || p.includes("koshary") || p.includes("pizza") || p.includes("had ")) {
        const food = p.includes("pizza") ? "Pizza (2 slices)" : p.includes("koshary") ? "Koshary (plate)" : "Logged Meal";
        logMeal({ mealName: food, mealType: "lunch", notes: "Logged via Ask NutriCoach" });
        reply = `I've logged ${food} for your lunch and rebalanced your remaining daily dinner targets accordingly.`;
        actionCard = {
          type: "logged",
          title: "Meal Logged & Rebalanced",
          details: `${food} logged · Dinner adapted`,
          actionLabel: "View Today's Meals",
          targetTab: "today",
        };
      } else {
        reply = `You have ${todayRemainingMacros.calories} kcal and ${todayRemainingMacros.protein}g protein remaining today. Let me know what you'd like to adjust, replace, or log!`;
      }

      const agentReplyMsg: AssistantMessage = {
        id: `ai-${Date.now()}`,
        sender: "agent",
        text: reply,
        actionCard,
        pendingConfirmation,
        time: "Just now",
      };

      setAiMessages((prev) => [...prev, agentReplyMsg]);
      setLoading(false);
    }, 400);
  };

  const handleConfirmAdd = (
    conf: NonNullable<AssistantMessage["pendingConfirmation"]>,
    choice: "today" | "tomorrow"
  ) => {
    const targetDate = choice === "today" ? state.today : addDays(state.today, 1);
    confirmAddMeal({
      mealName: conf.mealName,
      calories: conf.calories,
      protein: conf.protein,
      carbs: conf.carbs,
      fat: conf.fat,
      mealType: conf.mealType,
      targetDate,
      asLogged: choice === "today",
    });

    setAiMessages((prev) => [
      ...prev,
      {
        id: `ai-conf-${Date.now()}`,
        sender: "agent",
        text: `Done! Added ${conf.mealName} (${conf.calories} kcal) to ${choice === "today" ? "Today" : "Tomorrow"}'s meal stream.`,
        time: "Just now",
      },
    ]);
  };

  return (
    <aside className="w-[340px] shrink-0 border-l border-border bg-canvas flex flex-col justify-between h-screen sticky top-0 px-4 py-5 select-none">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-tint text-brand flex items-center justify-center font-medium">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-ink-primary">Ask NutriCoach</h3>
              <p className="text-[10px] text-ink-muted">Personal Nutrition Assistant</p>
            </div>
          </div>
          <span className="text-[10px] text-brand bg-brand-tint px-2 py-0.5 rounded font-medium border border-[#D5E6D2] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            Online
          </span>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-ink-muted uppercase tracking-wider">
            Suggested Prompts
          </div>
          <div className="flex flex-col gap-1">
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                className="text-[11px] bg-surface hover:bg-surface-subtle text-ink-secondary hover:text-ink-primary px-2.5 py-1.5 rounded-md border border-border hover:border-brand/40 transition-colors text-left truncate"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto my-3 space-y-2.5 pr-1 text-xs">
        {aiMessages.map((m, idx) => {
          const isUser = m.sender === "user";

          return (
            <div
              key={m.id || idx}
              className={`p-3 rounded-lg border text-xs leading-relaxed space-y-2 ${
                isUser
                  ? "bg-surface text-ink-primary border-border ml-4 shadow-hairline"
                  : "bg-[#FAFBF9] text-ink-primary border-border mr-2 shadow-hairline"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-ink-muted">
                <span className="font-semibold text-ink-primary">
                  {isUser ? "You" : "NutriCoach"}
                </span>
                <span>{m.time}</span>
              </div>

              <p className="text-xs text-ink-secondary leading-relaxed">{m.text}</p>

              {/* Conversational Verification Card */}
              {m.pendingConfirmation && (
                <div className="bg-surface rounded-md border border-border p-3 space-y-2 mt-2 shadow-hairline">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-ink-primary">
                      {m.pendingConfirmation.mealName}
                    </span>
                    <span className="text-[10px] text-brand font-semibold">
                      {m.pendingConfirmation.calories} kcal
                    </span>
                  </div>

                  <div className="text-[10px] text-ink-muted">
                    {m.pendingConfirmation.protein}g Protein · {m.pendingConfirmation.carbs}g Carbs · {m.pendingConfirmation.fat}g Fat
                  </div>

                  <div className="pt-1 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleConfirmAdd(m.pendingConfirmation!, "today")}
                      className="text-xs font-medium text-white bg-brand hover:bg-brand-hover px-3 py-1.5 rounded shadow-hairline transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Today</span>
                    </button>
                    <button
                      onClick={() => handleConfirmAdd(m.pendingConfirmation!, "tomorrow")}
                      className="text-xs text-ink-secondary hover:text-ink-primary bg-surface-subtle hover:bg-surface px-2.5 py-1.5 rounded border border-border transition-colors"
                    >
                      Schedule for Tomorrow
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Action Card */}
              {m.actionCard && (
                <div className="bg-surface rounded-md border border-border p-2.5 space-y-1.5 mt-2 shadow-hairline">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[11px] text-ink-primary">{m.actionCard.title}</span>
                    <span className="text-[10px] text-brand font-medium">Ready</span>
                  </div>
                  <p className="text-[11px] text-ink-muted">{m.actionCard.details}</p>

                  {m.actionCard.targetTab && (
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        onClick={() => setActiveTab(m.actionCard!.targetTab!)}
                        className="text-xs font-medium text-ink-primary hover:text-brand bg-surface-subtle hover:bg-surface px-2.5 py-1 rounded border border-border transition-colors flex items-center gap-1"
                      >
                        <span>{m.actionCard.actionLabel}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="p-2.5 rounded-lg bg-surface border border-border text-xs text-ink-muted animate-pulse flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            <span>NutriCoach is personalizing your recommendation...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="relative pt-2 border-t border-border">
        <input
          type="text"
          placeholder="Ask NutriCoach or describe what you ate..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="w-full text-xs bg-surface border border-border rounded-lg pl-3 pr-8 py-2 text-ink-primary focus:outline-none focus:border-brand shadow-hairline"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="absolute right-1.5 top-3.5 w-6 h-6 rounded bg-brand text-white flex items-center justify-center disabled:opacity-40 hover:bg-brand-hover transition-colors shadow-hairline"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}



