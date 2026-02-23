# Mission Control Tab Consolidation

## Overview

This document outlines the consolidation of the Operations and Blueprint tabs into a single Operations tab with a view toggle, plus creation of a dedicated Tasks tab for the Kanban board.

**Status:** Architecture designed, ready for implementation  
**Effort:** ~4-5 hours  
**Impact:** Cleaner tab structure, reduced redundancy, dedicated task management space

---

## Current State

**Problem:** Operations and Blueprint tabs are redundant
- Both show team status in different layouts (grid vs. spatial)
- Users must click between tabs to see different views of the same data
- No dedicated task management space

**Tabs in Navigation:**
- Operations (mission view)
- Blueprint (blueprint spatial view)
- AnselAI, R3 Studios (routes)
- System, Documents

---

## Proposed Structure

### Operations Tab (Merged)

**View Toggle:** "Team Grid" ↔ "Rooms" (Spatial/Blueprint view)

```
┌─ Operations Tab ──────────────────────────┐
│ View: [Team Grid ▼] | [Rooms v]          │
│                                            │
│ Agent Stats Dashboard (top)                │
│                                            │
│ Content Area:                              │
│  • Team Grid: Agent cards + stats         │
│  • Rooms: Spatial Blueprint layout        │
│                                            │
│ Right Panels: Chat | Whiteboard | etc     │
└────────────────────────────────────────────┘
```

### Tasks Tab (New, Dedicated)

Rename current "Blueprint" to "Tasks"

```
┌─ Tasks Tab ───────────────────────────────┐
│ Full Kanban Board                         │
│                                            │
│ [Filters] [Search] [Status View]          │
│                                            │
│ Queued | Active | Needs Review | Done     │
│ ──────   ──────   ──────────────   ────   │
│ ...      ...      ...              ...    │
│                                            │
│ Floating "+ Create Task" button (always   │
│ visible, bottom-right)                    │
└────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Add View State to Operations

Update `page.tsx`:

```typescript
// Add operationView state
const [operationView, setOperationView] = useState<"grid" | "rooms">("grid");

// In render:
{view === "mission" ? (
  <div>
    {/* View toggle buttons */}
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => setOperationView("grid")}
        className={operationView === "grid" ? "active" : ""}
      >
        📊 Team Grid
      </button>
      <button
        onClick={() => setOperationView("rooms")}
        className={operationView === "rooms" ? "active" : ""}
      >
        🏢 Rooms
      </button>
    </div>
    
    {operationView === "grid" ? (
      <MissionControl {...props} />
    ) : (
      <BlueprintView {...props} />
    )}
  </div>
) : null}
```

### Step 2: Create Tasks Tab

Update `page.tsx` ViewType:

```typescript
// OLD:
type ViewType = "mission" | "blueprint" | "documents" | "system";

// NEW:
type ViewType = "operations" | "tasks" | "documents" | "system";

// Rename "blueprint" → "tasks" in view state
const [view, setView] = useState<ViewType>("operations");
```

### Step 3: Update Tab Navigation

Update `TopBar.tsx`:

```typescript
{([
  { key: "operations" as ViewType, label: "🎯 Operations" },
  { key: "tasks" as ViewType, label: "📋 Tasks" },
  { key: "documents" as ViewType, label: "📄 Documents" },
  { key: "system" as ViewType, label: "⚡ System" },
]).map((t) => (
  <button
    key={t.key}
    onClick={() => onViewChange(t.key)}
    // ... styles
  >
    {t.label}
  </button>
))}
```

### Step 4: Render Logic

Update `page.tsx`:

```typescript
{view === "operations" ? (
  <OperationsWithViewToggle
    operationView={operationView}
    setOperationView={setOperationView}
    {...props}
  />
) : view === "tasks" ? (
  <TasksTab />
) : view === "documents" ? (
  <DocumentsView />
) : view === "system" ? (
  <SystemView />
) : null}
```

### Step 5: Add Floating Create Task Button

Add to main layout:

```typescript
<button
  className="fixed bottom-6 right-6 rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
  onClick={() => setCreateModalOpen(true)}
  style={{ background: "var(--accent-blue)", color: "#fff" }}
  title="Create Task"
>
  ➕
</button>
```

---

## Components Involved

### Update
- `app/page.tsx` - Main routing and state
- `components/TopBar.tsx` - Navigation tabs
- `components/MissionControl.tsx` - Stays same, just wrapped

### Create
- `components/TasksTab.tsx` - New dedicated tasks view
- `components/OperationsView.tsx` - Wrapper with view toggle

### Keep As-Is
- `components/BlueprintView.tsx` - Now used as "Rooms" view in Operations
- `components/TaskBoard.tsx` - Now used in Tasks tab
- `components/TaskQueuePanel.tsx` - Right-side panel

---

## Benefits

✅ **Cleaner navigation:** 4 clear tabs instead of 6  
✅ **Reduced redundancy:** Don't repeat Operations in two tabs  
✅ **Dedicated task space:** Full Kanban board with room to grow  
✅ **Better UX:** View toggle stays in Operations context  
✅ **Easier to understand:** Clear tab purposes  

---

## Testing Checklist

- [ ] Operations tab loads with grid view by default
- [ ] View toggle switches between Grid and Rooms
- [ ] Grid view shows agent cards and stats
- [ ] Rooms view shows spatial Blueprint layout
- [ ] Tasks tab opens to Kanban board
- [ ] Create Task button visible and functional
- [ ] All existing functionality preserved
- [ ] Navigation highlights correct tab
- [ ] Mobile responsive design maintained
- [ ] No TypeScript errors, build passes

---

## Files to Modify

1. `/app/page.tsx` - View type, state, rendering logic
2. `/components/TopBar.tsx` - Tab navigation labels
3. `/components/OperationsView.tsx` - NEW wrapper with toggle
4. `/components/TasksTab.tsx` - NEW dedicated task view

---

## Effort Estimate

- Step 1-2: 30 min (state management)
- Step 3: 20 min (TopBar updates)
- Step 4-5: 1 hour (rendering logic + button)
- Testing & refinement: 1-2 hours

**Total:** ~3-4 hours for polished implementation

---

## Notes

- Operations view toggle can use localStorage to persist user preference
- Consider keyboard shortcuts (Cmd+1 for Operations, Cmd+2 for Tasks)
- Floating button can be context-aware (hide on mobile, reposition)
- Right-side panels work with both Operations views
