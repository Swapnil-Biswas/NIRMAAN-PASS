import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log('--- NIRMAAN-PASS DATABASE STATUS CHECK ---');

if (!url || url.includes('placeholder') || url.includes('your-project')) {
  console.log('ℹ️  No remote Supabase database URL configured in .env.local.');
  console.log('✅ The application is running in STANDALONE LOCAL MODE using the verified 50-team dataset.');
  console.log('\nTo connect a new Supabase database:');
  console.log('1. Run supabase/complete_database_migration.sql in your Supabase SQL Editor.');
  console.log('2. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  console.log('3. Push all team data: npm run db:push\n');
  process.exit(0);
}

console.log('Connecting to Supabase at:', url);

if (!key) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in .env.local.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function verify() {
  let allGood = true;

  // 1. Check announcements table (readable by anon)
  try {
    const { data: ann, error: annError } = await supabase.from('announcements').select('*');
    if (annError) {
      console.log('❌ Announcements table:', annError.message, `(${annError.code})`);
      allGood = false;
    } else {
      console.log(`✅ Announcements table exists. Active records: ${ann?.length}`);
    }
  } catch (err) {
    console.log('❌ Announcements query exception:', err.message);
    allGood = false;
  }

  // 2. Check teams table
  try {
    const { data: teams, error: teamsError } = await supabase.from('teams').select('id').limit(1);
    if (teamsError) {
      console.log('❌ Teams table:', teamsError.message, `(${teamsError.code})`);
      allGood = false;
    } else {
      console.log(`✅ Teams table exists. Sample row fetched.`);
    }
  } catch (err) {
    console.log('❌ Teams query exception:', err.message);
    allGood = false;
  }

  // 3. Check members table
  try {
    const { data: members, error: memError } = await supabase.from('members').select('id').limit(1);
    if (memError) {
      console.log('❌ Members table:', memError.message, `(${memError.code})`);
      allGood = false;
    } else {
      console.log(`✅ Members table exists. Sample row fetched.`);
    }
  } catch (err) {
    console.log('❌ Members query exception:', err.message);
    allGood = false;
  }

  if (allGood) {
    console.log('\n🎉 ALL TABLES VERIFIED IN SUPABASE!');
  } else {
    console.log('\n⚠️ Tables not yet found in Supabase schema cache.');
    console.log('Please execute supabase/complete_database_migration.sql in your Supabase SQL editor.');
  }
}

verify();
