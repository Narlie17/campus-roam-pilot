/* Campus ROAM V14 settings.
   Leave supabaseUrl/supabaseAnonKey blank to run in LOCAL mode: the app fully works,
   but each student's data stays on their own phone and the admin console stays locked.
   Fill both in (same project in deploy-student and deploy-admin) for the multi-device pilot.
   The anon/publishable key is safe in the browser when RLS is enabled.
   NEVER paste a service_role or secret key here. */
window.ROAM_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  pilotEnd: '2026-12-20',
  campus: 'Georgia Southern University',
  target: 70,
  timeZone: 'America/New_York',
  // Shown in the app for withdrawal / deletion / questions. Use a domain email you own.
  contactEmail: 'nm14372@georgiasouthern.edu',
  // Public student link used by the admin "Invite" panel (e.g. https://campus-roam-students.netlify.app).
  studentUrl: '',
  // Optional: URL of a hosted events.json (campus-roam-app/data/events.json on GitHub Pages)
  // so events stay fresh without rebuilding data.js. Leave blank to use the bundled data.js.
  liveEventsUrl: '',
  // Hide new sign-ups after pilotEnd (existing participants can still sign in).
  closeSignupsAfterEnd: true
};
