const { createClient } = require('@supabase/supabase-js');

// We need the service role key to insert records directly bypass RLS
const supabase = createClient(
  'https://ykgbfrpkumlnogjdgqgb.supabase.co',
  'sb_publishable_c4jMZioQMqyhnh8tDdnYNA_KI8eW5_q'
);

async function run() {
  try {
    const idA = `delete_a_${Date.now()}@gmail.com`;
    const idB = `delete_b_${Date.now()}@gmail.com`;
    const pwd = 'Password123!';

    console.log('1. Creating User A...');
    const { data: uA, error: errA } = await supabase.auth.signUp({ email: idA, password: pwd });
    if (errA) throw errA;
    console.log('User A created:', uA.user.id);

    console.log('2. Creating User B...');
    const { data: uB, error: errB } = await supabase.auth.signUp({ email: idB, password: pwd });
    if (errB) throw errB;
    console.log('User B created:', uB.user.id);

    // Get tokens
    const tokenA = uA.session?.access_token;
    
    // We need to confirm their emails in the DB first so they can log in/interact
    console.log('3. Confirming emails in DB...');
    // We will do this via edge function or we can just call it since we don't have direct SQL in this JS file.
    // Wait, let's write a database query via Supabase CLI to update both users' emails to confirmed!
    console.log('Please confirm the emails first using CLI query...');

  } catch (err) {
    console.error('Test failed:', err);
  }
}

run();
