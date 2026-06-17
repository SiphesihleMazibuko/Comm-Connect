## Supabase setup

This app has a Supabase client configured in `config/supabase.js`.

Add your Supabase project details to `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

You can find both values in Supabase Dashboard > Project Settings > API.

Use the Project URL for `EXPO_PUBLIC_SUPABASE_URL`. Use the public `anon` key, or the public publishable key if your Supabase project shows publishable keys. Never put the `service_role` or secret key in this Expo app, because frontend environment variables are bundled into the client.

After changing `.env`, restart Expo so the new values are loaded.

The existing screens still use Firebase for auth and Firestore data. Supabase is now installed and ready to import with:

```js
import { supabase } from '../config/supabase';
```

When you create Supabase tables, enable Row Level Security and add policies that match the app's access model. For newer Supabase projects, also confirm the table is exposed to the Data API if the app needs to query it directly.

## Supabase tables expected by the app

The Firebase imports in the app screens have been replaced with Supabase calls. The app now expects these public tables:

- `users`
- `posts`
- `pinpoints`
- `reports`
- `emergencyRequests`
- `emergency_dispatches`

The app uses Supabase phone OTP for login and signup. Enable/configure Phone Auth in Supabase before testing those flows.

To fix `unsupported phone provider`:

1. Go to Supabase Dashboard > Authentication > Providers.
2. Enable the Phone provider.
3. Configure an SMS provider for the project, such as Twilio, MessageBird, Vonage, or TextLocal.
4. Save the provider settings, then restart the app and try signup again.

To fix `Could not find the table 'public.users' in the schema cache`:

1. Open Supabase Dashboard > SQL Editor.
2. Run the SQL in `supabase/schema.sql`.
3. Wait a few seconds for the API schema cache to refresh.
4. Try signup/login again.
