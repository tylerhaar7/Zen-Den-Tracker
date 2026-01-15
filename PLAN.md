# Zen Den Tracker - Implementation Plan

## Overview
A simple web application for elementary school counselors to track student visits to a calm-down room. Built with vanilla HTML/CSS/JavaScript and Supabase backend.

---

## Phase 1: Project Setup & Database

### 1.1 File Structure
```
zen-den-tracker/
├── index.html      # Main application (single page)
├── styles.css      # All styling
├── app.js          # Main application logic & UI
├── supabase.js     # Database connection & query functions
├── config.js       # Supabase credentials (user fills in)
└── PLAN.md         # This file
```

### 1.2 Supabase Database Schema
Create a single `visits` table:

```sql
CREATE TABLE visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  student_name TEXT NOT NULL,
  grade_level TEXT NOT NULL CHECK (grade_level IN ('K', '1', '2', '3', '4', '5')),
  staff_name TEXT NOT NULL,
  time_in TIMESTAMP WITH TIME ZONE NOT NULL,
  time_out TIMESTAMP WITH TIME ZONE,
  reason TEXT NOT NULL,
  emotion TEXT NOT NULL CHECK (emotion IN ('Angry', 'Sad', 'Anxious/Worried', 'Frustrated', 'Overwhelmed', 'Tired', 'Other')),
  date DATE NOT NULL
);

-- Index for common queries
CREATE INDEX idx_visits_date ON visits(date DESC);
CREATE INDEX idx_visits_time_out ON visits(time_out) WHERE time_out IS NULL;
CREATE INDEX idx_visits_student_name ON visits(student_name);
```

### 1.3 Config File Structure
```javascript
// config.js - User fills in their own credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

---

## Phase 2: HTML Structure

### 2.1 Page Layout
- **Header**: App title "Zen Den Tracker" with minimal branding
- **Navigation**: Tab-style navigation with 4 tabs
  - Check In (default/home)
  - Currently Here (with badge showing count)
  - Dashboard
  - History
- **Main Content**: Single content area that switches based on active tab
- **Footer**: Minimal, maybe just "Zen Den Tracker v1"

### 2.2 Tab Content Sections

**Check-In Tab:**
- Form with fields: student name, grade (dropdown), staff name, date, time-in, reason, emotion (button group)
- Large, clear submit button
- Success message area

**Currently Here Tab:**
- Card-based layout showing each checked-in student
- Each card: name, grade, time in, duration timer, check-out button
- Empty state message when no students present

**Dashboard Tab:**
- Summary stats cards at top (today/week/month counts)
- Charts/visualizations section (grade breakdown, emotion breakdown, time-of-day)
- Frequent visitors list
- Date range filter

**History Tab:**
- Filter controls (date range, grade, student name search, emotion)
- Data table with all visits
- Export CSV button

---

## Phase 3: CSS Styling

### 3.1 Design Principles
- **Child-friendly**: Large touch targets (min 44px), clear visual hierarchy
- **Calming colors**: Soft blues, greens, neutral tones (fits "Zen Den" theme)
- **High contrast**: Ensure readability for all users
- **Mobile-responsive**: Works on tablets, optimized for laptops

### 3.2 Key Style Decisions
- CSS custom properties (variables) for consistent theming
- Flexbox/Grid for layouts
- No external CSS frameworks - keep it simple
- Emotion buttons as large, colorful pill buttons
- Form inputs with generous padding and clear labels
- Tab navigation as horizontal button group

### 3.3 Responsive Breakpoints
- Mobile: < 768px (stack layouts vertically)
- Desktop: >= 768px (side-by-side layouts where appropriate)

---

## Phase 4: JavaScript Architecture

### 4.1 supabase.js - Database Layer
Functions to implement:
```javascript
// Connection
initSupabase()           // Initialize Supabase client

// Visits CRUD
createVisit(visitData)   // Insert new visit (check-in)
checkOutVisit(visitId)   // Update time_out for a visit
getActiveVisits()        // Get all visits where time_out IS NULL
getAllVisits(filters)    // Get visits with optional filters
getVisitsByDateRange(startDate, endDate)  // For reports

// Dashboard queries
getTodayCount()
getWeekCount()
getMonthCount()
getGradeBreakdown(startDate, endDate)
getEmotionBreakdown(startDate, endDate)
getTimeOfDayBreakdown(startDate, endDate)
getFrequentVisitors(days, minVisits)  // e.g., 30 days, 3+ visits
```

### 4.2 app.js - Application Layer
Main responsibilities:
- Tab navigation and view switching
- Form handling and validation
- Render functions for each view
- Event listeners
- LocalStorage for recent staff names
- Duration timer updates (for "Currently Here" view)
- CSV export generation
- Error handling and user feedback

### 4.3 State Management
Simple approach - no complex state library:
- Current tab stored in variable
- Active visits array refreshed on tab switch
- Recent staff names in localStorage

---

## Phase 5: Feature Implementation Details

### 5.1 Check-In Form
**Fields:**
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| student_name | text input | empty | Required, autocomplete off |
| grade_level | select dropdown | empty | K, 1, 2, 3, 4, 5 |
| staff_name | text input + datalist | empty | Datalist populated from localStorage |
| date | date input | today | Can adjust for late entries |
| time_in | time input | current time | Can adjust |
| reason | textarea | empty | Brief description |
| emotion | button group | none selected | Large clickable buttons |

**Behavior:**
- On submit: validate all fields, call createVisit(), show success, clear form
- Save staff name to localStorage recent list (max 10 names)
- Auto-refresh "Currently Here" count in nav badge

### 5.2 Currently Here View
**Display:**
- Cards in a grid/flex layout
- Each card shows:
  - Student name (large)
  - Grade level
  - Time checked in (formatted: "10:30 AM")
  - Duration ("45 minutes" - updates every minute)
  - Check Out button (prominent)

**Behavior:**
- Auto-refresh every 60 seconds
- Duration timers update every minute
- Check Out button → confirm dialog → update time_out → remove card
- Empty state: friendly message "No students currently in the Zen Den"

### 5.3 Dashboard View
**Summary Stats (top row):**
- Today: X visits
- This Week: X visits
- This Month: X visits

**Breakdowns (using simple bar charts or lists):**
- Grade breakdown: horizontal bar chart or table
- Emotion breakdown: horizontal bar chart or table
- Time of day: Morning (before 12pm) vs Afternoon (12pm+)

**Frequent Visitors:**
- Table showing students with 3+ visits in past 30 days
- Columns: Name, Grade, Visit Count
- Sorted by visit count descending

**Date Filter:**
- Start date and end date inputs
- "Apply" button to refresh all dashboard data

### 5.4 History View
**Filters:**
- Date range (start/end)
- Grade dropdown (All, K, 1, 2, 3, 4, 5)
- Student name search (text input)
- Emotion dropdown (All + each emotion)

**Table Columns:**
- Date
- Student Name
- Grade
- Staff
- Time In
- Time Out (or "Still here")
- Duration
- Emotion
- Reason

**Features:**
- Sorted by date/time descending (most recent first)
- Pagination or "Load more" for large datasets
- Export CSV button

### 5.5 CSV Export
**Format:**
```csv
Date,Student Name,Grade,Staff Name,Time In,Time Out,Duration (minutes),Emotion,Reason
2024-01-15,John Smith,3,Mrs. Johnson,09:30 AM,09:55 AM,25,Frustrated,Conflict with classmate
```

**Implementation:**
- Build CSV string from filtered data
- Create Blob and trigger download
- Filename: `zen-den-visits-YYYY-MM-DD.csv`

---

## Phase 6: Error Handling & UX

### 6.1 Error Scenarios
- Supabase connection failure → Show friendly error, suggest checking config
- Form validation errors → Highlight fields, show specific messages
- Database operation failure → Toast/alert with retry option

### 6.2 Loading States
- Show spinner/loading text during database operations
- Disable buttons during submission to prevent double-clicks

### 6.3 Success Feedback
- Check-in success: Green success message, form clears
- Check-out success: Card animates out, count updates
- Export success: File downloads automatically

---

## Implementation Order

1. **config.js** - Placeholder for credentials
2. **supabase.js** - Database connection and all query functions
3. **index.html** - Complete HTML structure
4. **styles.css** - All styling
5. **app.js** - Application logic, connecting everything

This order allows testing each layer as it's built.

---

## SQL to Run in Supabase

User will need to run this in Supabase SQL Editor:

```sql
-- Ensure pgcrypto extension is available for gen_random_uuid()
-- (Supabase typically has this enabled, but this ensures it)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the visits table
CREATE TABLE visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  student_name TEXT NOT NULL,
  grade_level TEXT NOT NULL CHECK (grade_level IN ('K', '1', '2', '3', '4', '5')),
  staff_name TEXT NOT NULL,
  time_in TIMESTAMP WITH TIME ZONE NOT NULL,
  time_out TIMESTAMP WITH TIME ZONE,
  reason TEXT NOT NULL,
  emotion TEXT NOT NULL CHECK (emotion IN ('Angry', 'Sad', 'Anxious/Worried', 'Frustrated', 'Overwhelmed', 'Tired', 'Other')),
  date DATE NOT NULL
  -- Note: date and time_in consistency is enforced by the application layer
  -- A DB constraint would cause timezone issues (e.g., 11pm local = next day UTC)
);

-- Create indexes for performance
CREATE INDEX idx_visits_date ON visits(date);
CREATE INDEX idx_visits_student_name ON visits(student_name);

-- Partial index for finding currently checked-in students (time_out IS NULL)
-- This is intentional: we frequently query for active visits
CREATE INDEX idx_visits_active ON visits(time_in) WHERE time_out IS NULL;

-- Enable Row Level Security (but allow all operations for now)
-- NOTE: This is intentionally permissive for v1 (no auth, trusted school environment)
-- For production with multiple users, add proper authentication policies
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (no auth for v1)
CREATE POLICY "Allow all operations" ON visits
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

---

## Questions / Decisions

None at this time - requirements are clear and comprehensive.
