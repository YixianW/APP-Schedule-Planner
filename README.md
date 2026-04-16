# AI Schedule Planner

React Native + Expo mobile app for planning a day, generating a smarter schedule with Claude, and saving events locally with AsyncStorage.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file in the project root:

```bash
cp .env.example .env
```

3. Add your Anthropic API key to `.env`:

```bash
EXPO_PUBLIC_ANTHROPIC_API_KEY=your_key_here
```

4. Start the Expo dev server:

```bash
npm run start
```

## Environment Variables

The app reads only this variable:

- `EXPO_PUBLIC_ANTHROPIC_API_KEY`

## Android Testing

1. Install Expo Go on your Android phone.
2. Start the app with `npm run start`.
3. Scan the QR code from the terminal or Expo Dev Tools.
4. Make sure your phone and development machine are on the same network, or use Expo tunnel if needed.
5. Add a few events, then tap Generate Plan to confirm Claude integration and plan persistence.

## Notes

- Events and the latest generated plan are stored locally in AsyncStorage.
- The API key is used directly from the client through `process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY`.
- This is acceptable for a class project, but not production-safe; a real app should proxy requests through a backend.