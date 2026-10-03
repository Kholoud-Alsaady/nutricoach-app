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

### 2. Autonomous Nutrition Rebalancing Flow

```mermaid
sequenceDiagram
    autonumber
    actor Member as Gym Member (e.g., Layla)
    participant App as Member App
    participant AI as NutriCoach AI Agent
    participant Engine as Deterministic Macro Engine
    actor Coach as Coach Captain Ahmed
    participant DB as Supabase Database

    Member->>App: Logs off-plan meal (e.g., Large Koshary at lunch: 900 kcal, 160g C)
    App->>Engine: Calculate consumed vs. target daily macros
    Engine-->>AI: Deviation Detected (+60g Carbs above planned budget)
    
    AI->>Engine: Query high-protein / low-carb Egyptian dinner alternatives
    Engine-->>AI: Propose Lean Turkey Wrap (540 kcal, 54g P, 18g C)
    
    AI->>App: Render Instant Adaptive Adjustment Box
    App-->>Member: "Rebalance Dinner: Keep this change or Choose alternative"
    
    alt Member confirms adjustment
        Member->>App: Clicks "Keep this change"
        App->>DB: Update today's dinner slot & recalculate remaining budget
        App->>DB: Log executed agent action to Audit Trail
    else Requires Coach Approval (e.g. chronic deficit)
        AI->>DB: Flag priority exception in Coach Triage Queue
        Coach->>App: Reviews exception in Coach Hub & Approves adjustment
        App->>DB: Commit verified plan adaptation
    end
```

### 3. Chat Architecture: AI Copilot vs. Human Coach Channel

```mermaid
graph LR
    subgraph Member_Interface["Member App View"]
        direction TB
        subgraph Center_Workspace["Center Workspace (640px)"]
            CDV["Ask Coach / Direct Coach Support<br/>──────────────────────<br/>• Direct thread with Coach Captain Ahmed<br/>• Verified Coach badge & signature<br/>• Lifestyle & training inquiries<br/>• Attach meal log capability"]
        end
        subgraph Right_Panel["Persistent Right Panel (340px)"]
            APC["Ask NutriCoach (AI Assistant)<br/>──────────────────────<br/>• Online Green Indicator<br/>• Real-time meal replacements<br/>• Dynamic food logging<br/>• Egyptian recipe suggestions"]
        end
    end

    subgraph Coach_Workspace["Coach Dashboard"]
        MQ["Member Questions Inbox<br/>(Live bidirectional chat sync)"]
    end

    subgraph State_Sync["State & Storage"]
        STORE["NutriCoach Unified Store"]
    end

    CDV <-->|Sync messages & replies| MQ
    CDV --> STORE
    APC --> STORE
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
