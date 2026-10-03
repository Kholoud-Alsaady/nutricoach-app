"use client";

import React, { useState } from "react";
import { Paperclip, Send, ShieldCheck, Sparkles, User, UserCheck } from "lucide-react";
import { timeAgo } from "@/lib/dates";
import { useNutriCoach } from "./NutriCoachContext";

export function CoachDirectView() {
  const { activeProfile, allMessages, sendMemberMessage } = useNutriCoach();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messages = allMessages[activeProfile.id] || [];

  const suggestedInquiries = [
    "Should I increase protein on leg days?",
    "How should I balance lunch before a late dinner?",
    "Feeling fatigued after workouts, any snack advice?",
    "Travelling this weekend, how to handle dining out?",
  ];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    if (!textToSend) setInput("");
    setLoading(true);

    try {
      await sendMemberMessage(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-140px)] min-h-[560px]">
      {/* Coach Header Profile Card */}
      <div className="bg-surface rounded-lg border border-border p-4 shadow-card flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center font-bold text-base shadow-hairline">
              CA
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#3FB950] border-2 border-surface" />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink-primary">Coach Captain Ahmed</h3>
              <span className="text-[10px] px-2 py-0.5 bg-brand-tint text-brand rounded font-medium border border-[#D5E6D2]">
                Senior Specialist
              </span>
            </div>
            <p className="text-xs text-ink-secondary">
              Assigned Human Nutrition Coach · <span className="text-ink-muted">Usually replies within 2 hours</span>
            </p>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <span className="text-[11px] text-ink-muted block">Direct line for {activeProfile.name}</span>
          <span className="text-[10px] text-brand font-medium flex items-center justify-end gap-1 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified Coach Desk
          </span>
        </div>
      </div>

      {/* Suggested Inquiries Pills */}
      <div className="bg-surface-subtle p-3 rounded-lg border border-border space-y-1.5">
        <div className="text-[10px] font-medium text-ink-muted uppercase tracking-wider">
          Suggested Inquiries for Coach Ahmed
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestedInquiries.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="text-xs bg-surface hover:bg-surface-subtle text-ink-secondary hover:text-ink-primary px-3 py-1.5 rounded-md border border-border hover:border-brand/40 transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Direct Conversation Thread */}
      <div className="flex-1 bg-surface rounded-lg border border-border p-4 shadow-card overflow-y-auto space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 text-ink-muted">
            <UserCheck className="w-8 h-8 text-brand/60" />
            <div className="text-xs font-medium text-ink-primary">No messages yet with Coach Ahmed</div>
            <p className="text-[11px] max-w-sm">
              Send a note below about your dietary preferences, workout schedule, or questions about your macros.
            </p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMember = m.sender === "member";
            const isCoach = m.sender === "coach";

            return (
              <div
                key={m.id || idx}
                className={`flex flex-col ${isMember ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-ink-muted mb-1 px-1">
                  <span className="font-semibold text-ink-primary">
                    {isMember ? "You" : isCoach ? "Coach Captain Ahmed" : "NutriCoach Desk"}
                  </span>
                  <span>·</span>
                  <span>{timeAgo(m.created_at)}</span>
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
                    isMember
                      ? "bg-surface text-ink-primary border-border shadow-hairline rounded-tr-xs"
                      : isCoach
                      ? "bg-[#F4F8F3] text-ink-primary border-[#D5E6D2] shadow-hairline rounded-tl-xs"
                      : "bg-[#FAFBF9] text-ink-primary border-border rounded-tl-xs"
                  }`}
                >
                  {isCoach && (
                    <div className="flex items-center gap-1.5 text-[10px] text-brand font-semibold mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                      <span>COACH DIRECT</span>
                    </div>
                  )}

                  <p className="text-xs text-ink-primary whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-subtle text-xs text-ink-muted animate-pulse">
            <span className="w-2 h-2 rounded-full bg-brand" />
            <span>Sending message to Coach Ahmed&apos;s workspace...</span>
          </div>
        )}
      </div>

      {/* Dedicated Coach Message Input Bar */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="bg-surface p-2.5 rounded-lg border border-border shadow-card flex items-center gap-2">
        <button
          type="button"
          title="Attach meal / progress note"
          className="p-2 text-ink-muted hover:text-ink-primary hover:bg-surface-subtle rounded-md transition-colors"
          onClick={() => setInput((prev) => prev ? `${prev} [Attached Meal Log]` : "Sharing my recent meal log with you Coach Ahmed: ")}
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          placeholder="Write a message to Coach Captain Ahmed..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 text-xs bg-transparent border-none px-2 py-1.5 text-ink-primary focus:outline-none placeholder:text-ink-muted"
        />

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="text-xs font-medium text-white bg-brand hover:bg-brand-hover px-4 py-2 rounded-md shadow-hairline transition-colors flex items-center gap-1.5 disabled:opacity-40"
        >
          <span>Send Message</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
