const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const supabaseUrl = 'https://ykgbfrpkumlnogjdgqgb.supabase.co';
const supabaseAnonKey = 'sb_publishable_c4jMZioQMqyhnh8tDdnYNA_KI8eW5_q';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const randomSuffix = Math.floor(Math.random() * 1000000);
    const testEmail = `delete.test.user.${randomSuffix}@gmail.com`;
    const testPassword = 'Password123!';
    // Hashed value of 'Password123!'
    const passwordHash = '$2a$10$UoW1iLcrV0G72Yx.tK/Jk.5Z0F6q4.M3sL7u/eO1B3G2o1jKx2LWy';

    console.log('1. Creating test user via direct SQL insert:', testEmail);
    const query = `
      WITH new_user AS (
        INSERT INTO auth.users (
          id, instance_id, email, encrypted_password, email_confirmed_at, 
          created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data, 
          is_super_admin, is_sso_user, is_anonymous
        ) VALUES (
          gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '${testEmail}',
          '${passwordHash}', now(),
          now(), now(), 'authenticated', 'authenticated', '{"provider": "email", "providers": ["email"]}', '{}',
          false, false, false
        ) RETURNING id, email
      )
      INSERT INTO auth.identities (
        id, user_id, provider_id, provider, identity_data, created_at, updated_at
      )
      SELECT 
        gen_random_uuid(), id, email, 'email', 
        jsonb_build_object('sub', id, 'email', email, 'email_verified', true),
        now(), now()
      FROM new_user
      RETURNING user_id AS id;
    `;

    const fs = require('fs');
    fs.writeFileSync('temp_insert.sql', query);

    const execCmd = `npx supabase db query --linked -f temp_insert.sql`;
    const sqlOutput = execSync(execCmd).toString();
    console.log('SQL insert output:', sqlOutput);

    fs.unlinkSync('temp_insert.sql');


    // Parse user ID from SQL Output
    const parsed = JSON.parse(sqlOutput);
    const userId = parsed.rows[0].id;
    console.log('✓ Created user successfully. User ID:', userId);

    console.log('2. Signing in to get JWT token...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.error('Sign in failed:', signInError);
      return;
    }

    const token = signInData.session?.access_token;
    console.log('✓ Signed in successfully.');

    console.log('3. Invoking delete-user-account edge function...');
    const response = await fetch(
      `${supabaseUrl}/functions/v1/delete-user-account`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey
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

