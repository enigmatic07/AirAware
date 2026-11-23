/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Public Firebase Web Client Credentials
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;

  // Optional CPCB / Open Government Data
  readonly VITE_DATA_GOV_IN_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
