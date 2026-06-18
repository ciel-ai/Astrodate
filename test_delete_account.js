const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ykgbfrpkumlnogjdgqgb.supabase.co',
  'sb_publishable_c4jMZioQMqyhnh8tDdnYNA_KI8eW5_q'
);

async function run() {
  try {
    const testEmail = 'delete.test.user.908367@gmail.com';
    const testPassword = 'Password123!';

    console.log('1. Signing in test user:', testEmail);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.error('Sign in failed:', signInError);
      return;
    }

    const token = signInData.session?.access_token;
    console.log('✓ Signed in successfully. User ID:', signInData.user?.id);

    console.log('2. Invoking delete-user-account edge function...');
    const response = await fetch(
      'https://ykgbfrpkumlnogjdgqgb.supabase.co/functions/v1/delete-user-account',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': 'sb_publishable_c4jMZioQMqyhnh8tDdnYNA_KI8eW5_q'
        }
      }
    );

    console.log('Status Code:', response.status);
    const bodyText = await response.text();
    console.log('Response Body:', bodyText);

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

run();
