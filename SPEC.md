# SPEC.md — AI Schedule Planner

## App Name
AI Schedule Planner（AI 行程助手）

## Overview
A mobile app that helps users plan their daily schedule intelligently. Users input events/tasks with times, locations, and notes, then an AI (Claude API) analyzes everything and generates a smart, optimized schedule — including travel time estimates and suggestions for when to leave and when to start tasks.

## Target Platform
- Android (physical device via Expo Go)
- Built with React Native + Expo (SDK 54)

## Screens

### Screen 1: Event Input (Home Screen)
- **Header:** Today's date and app title ("AI Schedule Planner")
- **Event list:** Shows all events the user has added for the day
- Each event card displays:
  - Event name (e.g., "Class", "Pick up husband", "Evening event")
  - Time (the deadline/target time, not when to start preparing)
  - Location (optional)
  - Notes (optional, e.g., "need to drop off husband at Diamond Run first")
- **"Add Event" button:** Opens a form/modal with:
  - Event name (TextInput, required)
  - Time (time picker or TextInput)
  - Location (TextInput, optional)
  - Notes (TextInput, optional)
- **Edit/Delete:** Tap to edit, swipe or button to delete
- **"Generate Plan" button:** Sends all events to Claude API and navigates to Screen 2

### Screen 2: AI-Generated Plan
- **Header:** "Your Optimized Schedule"
- Displays the AI-generated plan as a chronological timeline
- Each item shows:
  - Suggested start/departure time
  - What to do
  - AI reasoning/tips (e.g., "Leave by 9:15 to arrive at CMU by 10:00")
- **"Back" button:** Return to Screen 1 to modify events
- **"Save Plan" button:** Saves the generated plan to local storage

## User Input
- Text inputs for event name, time, location, notes
- Buttons for add, edit, delete, generate plan, save plan
- Navigation between screens

## Data Persistence (AsyncStorage)
- All user-added events are saved locally and survive app restart
- The most recent AI-generated plan is also saved locally
- On app open, previously saved events are loaded automatically

## AI Integration
- Uses Anthropic Claude API (model: claude-sonnet-4-20250514)
- The app sends all events as a prompt to Claude, asking it to:
  - Arrange events chronologically
  - Estimate approximate travel times between locations
  - Suggest optimal departure/start times
  - Flag any conflicts

## API Key Handling (IMPORTANT)
- **No backend server** — the app calls Claude API directly (acceptable for class project)
- API key is stored in a local `.env` file in the project root
- The `.env` file is listed in `.gitignore` and **never committed to GitHub**
- The app reads the key via `process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY` (Expo's built-in env var support)
- README includes setup instructions: users must create their own `.env` with their own API key to run the app
- **Security limitation acknowledged:** in a production app, the key would be handled by a backend server. This is documented as a known limitation in the README.

## Visual Design
- Clean, minimal design with 2–3 consistent colors
- Card-based layout for events
- Timeline-style layout for the generated plan
- Readable fonts, clear spacing

## Acceptance Criteria
1. [ ] App launches without errors on Android via Expo Go
2. [ ] Screen 1 displays a list of user-added events
3. [ ] User can add a new event with name, time, location, and notes
4. [ ] User can edit and delete existing events
5. [ ] Events persist after closing and reopening the app
6. [ ] "Generate Plan" button sends events to Claude API and receives a response
7. [ ] Screen 2 displays the AI-generated schedule in a readable timeline format
8. [ ] User can navigate between Screen 1 and Screen 2
9. [ ] The most recent generated plan is saved and viewable after app restart
10. [ ] App has consistent, intentional styling (colors, spacing, readability)
11. [ ] `.env` file is in `.gitignore` and API key is never committed to the repo
12. [ ] App handles API errors gracefully (no internet, invalid key, API failure)

## Out of Scope (for this assignment)
- Map/GPS integration
- Multi-day trip planning (focus on single-day for now)
- User accounts or cloud sync
- Push notifications / reminders
- Voice input
- Production-grade API key security (would require backend)

## Technical Stack
- React Native + Expo (SDK 54)
- React Navigation (stack navigator)
- AsyncStorage for local data persistence
- Anthropic Claude API for AI planning (direct client-side call)
- `.env` file + `EXPO_PUBLIC_ANTHROPIC_API_KEY` env variable

## Known Limitations
- API key stored client-side (not production-safe; OK for class project)
- Travel time estimates are AI approximations, not real map data
- Requires internet connection for AI features
- Single-user, single-device (no account/sync)
