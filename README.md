# MatchGapper — PCC GAP Team Match Manager

A React-based management tool for organizing BMW GAP (Golf Association of Philadelphia) inter-club team matches at Phoenixville Country Club.

## What It Does

Every spring, PCC fields two teams across three weeks of head-to-head matches against other GAP member clubs. This app handles the entire workflow — from recruiting players, to building strategic pairings, to communicating assignments.

### The Problem
Coordinating 24+ players across 3 weeks, 2 teams, home/away splits, handicap thresholds, and shifting availability used to live in a sprawling Excel spreadsheet. Players drop in, players drop out, handicaps change, and captains need real-time visibility to make smart decisions.

### The Solution
A single-page app that gives the Golf Professional and Team Captains a shared workspace to recruit, roster, pair, and communicate — with drag-and-drop team building, automated handicap analysis, and one-click summaries.

---

## Features

### Dashboard
- **Roster Recruitment KPIs** — Full roster count, confirmed, maybe, contacted, declined, not contacted
- **Handicap Distribution Chart** — Full-width vertical bar chart showing roster depth across 6 handicap brackets with confirmed/maybe/not-yet stacking and team projection badges
- **Overall Team Pools** — Team 1 and Team 2 pool sizes, handicap ranges, and average handicaps
- **Weekly Breakdown** — Per-week team composition with availability bars, handicap ranges, averages, and opponent details
- **Follow-Up Targets** — Four-column actionable list organized by status

### Roster Management
- **CSV/XLSX Upload** — Import player rosters with auto-detection of columns
- **Inline Editing** — Click any field to edit: name, handicap, index, GHIN, notes
- **Status Tracking** — Not Contacted → Contacted → Confirmed / Maybe / Declined
- **Contact Info** — Phone (click-to-call) and email icons per player
- **Availability Grid** — Per-week Yes/No/Maybe for each player
- **Location Preference** — Per-week Home/Away/No Preference for each player

### Team Builder (Drag & Drop)
- **Player Pool Sidebar** — Available players sorted by handicap and color-coded by projected team
- **6-Pair Layout** — 3 Home pairs (Phoenixville CC) and 3 Away pairs (opponent club) per team
- **Tee Time Intervals** — First tee displayed per pair, remaining at 10-minute intervals
- **Pairing Archetypes** — Auto-detected pair chemistry labels
- **Handicap Threshold Enforcement** — Visual warnings for team boundary crossings
- **Location Preference Warnings** — Flags mismatched home/away placements
- **Lock/Unlock Workflow** — Lock pairings when finalized with stale-change tracking

### Season Setup
- **3-Week Schedule** — Date, home tee time, away tee time per week
- **Opponent Configuration** — Club name with searchable GAP member dropdown, team number
- **Map Links** — Auto-generated Google Maps link for each opponent club

### Communication
- **Copy Summary** — One-click formatted text with all pairings, tee times, locations
- **Email Subject Builder** — Pre-formatted subject line for captain communications

### Role-Based Access
- Pro / Admin, Captain, Vice-Captain, Player roles

---

## Match Structure

Each week, PCC plays two separate matches simultaneously:
- **Team 1** vs. Opponent A
- **Team 2** vs. Opponent B

Each match consists of **6 pairs** (12 players per team):
- 3 pairs play **Home** at Phoenixville CC
- 3 pairs play **Away** at the opponent's club

Matches are **straight-up** (no handicap strokes). The team threshold rule ensures no player on Team 1 has a higher handicap than the lowest on Team 2.

---

## Tech Stack

- **React 18** — Single-file component with hooks
- **No build step** — Runs via Babel standalone in the HTML file
- **No backend yet** — Supabase integration planned

## Files

| File | Purpose |
|------|---------|
| gap-manager.jsx | React component (source of truth) |
| gap-manager.html | Standalone HTML wrapper — double-click to run |
| README.md | This file |

## Roadmap

- Supabase backend for persistence and real-time sync
- Player notifications (tee time, opponent, map link)
- GHIN/GAP Locker handicap auto-update
- Whoosh Pro Shop integration
- Mobile player view
- Historical match results

## Usage

**Open locally:** Double-click gap-manager.html — loads React from CDN.
**Claude Artifact:** Upload gap-manager.jsx to Claude.

---

Built for the 2026 BMW GAP season at Phoenixville Country Club.
