# NutriCoach

> **Live Application**: [NutriCoach — Adaptive AI Nutrition for Gyms](https://nutricoach-app-gray.vercel.app/)

NutriCoach is an adaptive AI nutrition platform designed for gym athletes and coaches. Instead of static meal plans, NutriCoach continuously adapts daily nutrition targets based on what members actually eat, while keeping coaches in control of exceptions.

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

    subgraph Engine_Tier["Autonomous Engine & Logic"]
        CTX[NutriCoach Unified Reactive State]
        ME[Deterministic Macro & Egyptian Food Engine]
        ORCH[Agent Orchestrator & Tool Executor]
    end

    subgraph Data_Tier["Storage & Security"]
        MW[Edge Middleware Session Guard]
        SSR[Supabase SSR Client]
        PG[(PostgreSQL Database with RLS)]
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

---

### 2. Autonomous Adaptation & Rebalancing Flow

```mermaid
sequenceDiagram
    autonumber
    actor Member as Gym Member (e.g., Layla)
    participant App as Member App
    participant AI as NutriCoach AI Agent
    participant Engine as Deterministic Macro Engine
    actor Coach as Coach Captain Ahmed
    participant DB as Supabase Database

    Member->>App: Logs off-plan meal (e.g. Koshary at lunch: 900 kcal, 160g C)
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
    else Chronic Deficit / Flagged Exception
        AI->>DB: Flag priority exception in Coach Triage Queue
        Coach->>App: Reviews exception in Coach Hub & Approves adjustment
        App->>DB: Commit verified plan adaptation
    end
```

---

### 3. Chat Architecture: Persistent AI Copilot vs. Human Coach Channel

```mermaid
graph LR
    subgraph Member_Interface["Member App View"]
        direction TB
        subgraph Center_Workspace["Center Workspace (640px)"]
            CDV["Ask Coach / Direct Coach Support<br/>──────────────────────<br/>• Direct thread with Coach Captain Ahmed<br/>• Verified Coach badge & signature<br/>• Training & lifestyle inquiries<br/>• Attach meal log support"]
        end
        subgraph Right_Panel["Persistent Right Panel (340px)"]
            APC["Ask NutriCoach (AI Assistant)<br/>──────────────────────<br/>• Online status indicator<br/>• Instant meal replacements<br/>• Dynamic food logging<br/>• Egyptian recipe suggestions"]
        end
    end

    subgraph Coach_Workspace["Coach Dashboard"]
        MQ["Member Questions Inbox<br/>(Live bidirectional chat sync)"]
    end

    CDV <-->|Sync messages & replies| MQ
```

---

## 🌟 Key Features

- **3-Zone Member Experience**: Sidebar navigation, flexible center workspace (Macro summary, Curated guides, Adaptive before/after box, Meals stream, and Direct Coach Messaging), and persistent **Ask NutriCoach** AI assistant.
- **Coach Hub Workflows**: Overview dashboard with 7-day adherence charts, priority triage queue, member messaging inbox, and autonomous agent audit log.
- **Deterministic Egyptian Macro Engine**: Mathematical calorie verification ($P \times 4 + C \times 4 + F \times 9$) and authentic Egyptian food database (Ful medames, Koshary, Grilled sea bass, Molokhia, Kofta, Shish taouk, and Greek yogurt bowls).

---

## 👥 Demo Personas

1. **Omar Hassan** — *Consistent Progress*: 100% adherence streak, hypertrophy targets (2,450 kcal / 160g protein).
2. **Sara El-Masry** — *Single Miss*: Missed dinner due to late flight; demonstrates anti-overcompensation logic.
3. **Layla Mostafa** — *Repeated Deviation*: Logged off-plan lunch; triggers instant dinner rebalancing.
4. **Ahmed Nabil** — *Protein Gap*: Hits calorie goal but falls short on protein; triggers high-protein snack upgrades.
5. **Mariam Farouk** — *Dietary Shift*: Pescatarian transition; filters out poultry/meat while meeting protein targets.
6. **Youssef Adel** — *Inactivity Alert*: 4 days without logging; triggers proactive coach check-in.

---

## 💻 Tech Stack

- **Framework**: Next.js 15 (App Router, Server & Client Components)
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS) & SSR
- **Language & Styling**: TypeScript 5, Tailwind CSS, Lucide Icons
- **AI Agent**: Google Gemini API with local deterministic fallback

---

## 🚀 Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment in .env.local
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 3. Seed initial demo personas and plans
npm run seed

# 4. Start local development server
npm run dev
```
