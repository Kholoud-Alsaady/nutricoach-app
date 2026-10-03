"use client";

import React from "react";
import { useNutriCoach } from "@/components/NutriCoachContext";
import { LandingPortal } from "@/components/LandingPortal";
import { MemberLayout } from "@/components/MemberLayout";
import { CoachLayout } from "@/components/CoachLayout";

export default function Home() {
  const { currentView } = useNutriCoach();

  if (currentView === "portal") {
    return <LandingPortal />;
  }

  if (currentView === "coach") {
    return <CoachLayout />;
  }

  return <MemberLayout />;
}

