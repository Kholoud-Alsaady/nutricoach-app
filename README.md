# NutriCoach

> **Live Application**: [NutriCoach — Adaptive AI Nutrition for Gyms](https://nutricoach-app-gray.vercel.app/)

NutriCoach is an adaptive AI nutrition platform built for gym athletes and coaches. Instead of static, inflexible meal plans, NutriCoach continuously adapts daily nutrition targets based on what members actually eat, while keeping coaches in control of exceptions.

---

## 🏛️ Architecture Diagrams

### 1. System Topology & Dual Experiences

```mermaid
graph TD
    subgraph Client_Tier["Client Experience (Next.js 15 App Router)"]
        LP[Landing Portal / Role Selector]
        
        subgraph Member_App["Member App (3-Zone Layout)"]
            MS[Member Sidebar 220px]
            MC[Main Center Workspace 640px<br/>Today · Meal Plan · Progress · Profile · Direct Coach]
            ANC[Ask NutriCoach Copilot 340px<br/>Persistent AI Assistant]
        end

        subgraph Coach_Hub["Coach Workspace (4 Tabs)"]
            CS[Coach Sidebar 220px]
            CO[1. Overview Dashboard]
            CT[2. Needs Attention / Triage]
            CQ[3. Member Questions Inbox]
            CA[4. Agent Activity Audit Log]
        end
    end

    subgraph Logic_Tier["Autonomous Nutrition & Agent Engine"]
        CTX[NutriCoach React Context & Reactive State]
        ME[Deterministic Macro & Food Engine<br/>Egyptian Nutrition DB]
        ORCH[Agent Orchestrator & Tool Executor]
    end

    subgraph Data_Tier["Data & Security Layer"]
        MW[Edge Middleware Session Guard]
        SSR[Supabase SSR Client<br/>createBrowserClient / createServerClient]
        PG[(Supabase PostgreSQL Database<br/>RLS Security Enabled)]
    end

    LP --> Member_App
    LP --> Coach_Hub
    
    Member_App --> CTX
    Coach_Hub --> CTX
    
    CTX --> ME
    CTX --> ORCH
    
    CTX --> SSR
    SSR --> MW
    MW --> PG
```

### 2. Member Onboarding, Plan Generation & Coach Synchronization Flow

```mermaid
sequenceDiagram
    autonumber
    actor Athlete as Gym Member / User
    participant Portal as Landing Portal / Registration
    participant Engine as NutriCoach AI Planner & Macro Engine
    participant Store as Unified State & Database
    actor Coach as Coach Workspace (Captain Ahmed)

    Athlete->>Portal: Clicks "+ Create New Member"
    Athlete->>Portal: Inputs InBody biometrics (Weight, Height, Sex), Preferences & Fitness Goal
    
    Portal->>Engine: Send biometric profile & dietary parameters
    Engine->>Engine: Calculate BMR, TDEE, & Calorie/Protein target allocations
    Engine->>Engine: Generate 7-day adaptive Egyptian meal plan, initial stream & compliance baseline
    
    Engine->>Store: Save member profile, nutrition targets, planned meals & logs
    
    par Member App Activation
        Store-->>Athlete: Launch Personalized Member App
        Note over Athlete: Access active Today's Stream, Weekly Planner, Compliance Gauges & Ask NutriCoach AI
    and Real-Time Coach Hub Sync
        Store-->>Coach: Update Coach Roster in Real-Time
        Note over Coach: New athlete instantly appears in Member Directory, Adherence Overview & Coach Chat
    end
```

---

## 📱 Two Distinct Interfaces

### 1. Member App (3-Zone Clean Workspace)
- **Navigation Sidebar (220px)**: Quick switching between Daily Tracking, Meal Planner, Adherence Trends, Coach Direct Line, and Profile.
- **Center Workspace (640px)**:
  - **Macro Summary & Gauges**: Real-time calorie and macronutrient balance.
  - **Adaptive Before/After Box**: Immediate visual diff when meals deviate.
  - **Meals Stream**: Interactive logging with portion adjustments.
  - **Direct Coach Support**: 1-on-1 private messaging channel with assigned human coach (Coach Captain Ahmed).
- **Persistent AI Panel (340px)**: **Ask NutriCoach** copilot for quick Egyptian recipe recommendations, calorie calculations, and meal swaps.

### 2. Coach Workspace (4 Primary Workflows)
- **Overview Dashboard**: Team compliance trends, 7-day adherence charts, and aggregate consistency metrics.
- **Needs Attention / Triage**: Priority worklist flagging deviations, protein gaps, and member inactivity for coach intervention.
- **Member Questions Inbox**: Direct communication desk to read and answer incoming athlete inquiries.
- **Agent Activity Log**: Verifiable audit trail showing automated plan adjustments and coach time saved.

---

## ⚡ Core Features

- **Autonomous Meal Rebalancing**: Automatically recalculates dinner and snacks when lunch deviates from target macros.
- **Deterministic Macro Verification**: Calorie calculations are mathematically verified ($P \times 4 + C \times 4 + F \times 9$).
- **Egyptian Food Intelligence**: Built-in authentic Egyptian database (Ful medames, Koshary, Grilled sea bass, Molokhia, Kofta, Shish taouk, Greek yogurt bowls).
- **Separated Chat Architecture**: Dedicated 1-on-1 Human Coach Inbox cleanly separated from the persistent real-time AI Assistant.
- **Interactive Personas**: 6 pre-configured member scenarios demonstrating stable streaks, missed logs, carbohydrate deviations, protein gaps, dietary shifts, and inactivity alerts.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router, Server & Client Components)
- **Backend & Database**: Supabase PostgreSQL with Row Level Security (RLS) & SSR
- **Language & Styling**: TypeScript, Tailwind CSS, Lucide Icons
- **AI Engine**: Google Gemini API with deterministic rule-based fallback
