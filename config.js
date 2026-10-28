/* PLAYMODE · live-play configuration (Supabase Realtime).
   Leave both values empty to run in DEMO MODE (no network; tabs in one browser only).

   Use ONLY your project's public values:
     supabaseUrl             → Project Settings → Data API / API → Project URL        e.g. https://abcd1234.supabase.co
     supabasePublishableKey  → Project Settings → API Keys → Publishable key          e.g. sb_publishable_…   (or the legacy "anon" key)
   NEVER put a secret key (sb_secret_…) or the service_role key here — this file is downloaded by every browser.
   The app refuses those keys. See README.md → "Live multi-device play". */
window.PLAYMODE_CONFIG = {
  supabaseUrl: 'https://jqynodrszdyqbjbofwpw.supabase.co',
  supabasePublishableKey: 'sb_publishable_b1e9Njw6_Ugebay1ar2o0A_FnAkstyO'
};
