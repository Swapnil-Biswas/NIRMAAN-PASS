import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgpxcqazpifkifsnfmmz.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_c2UWGV6nf9YMEUOD_VWrbQ_LqtY0EuD';

console.log('--- SUPABASE MIGRATION VERIFICATION ---');
console.log('Target URL:', url);

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
    console.log('\n🎉 ALL TABLES SUCCESSFULLY MIGRATED TO SUPABASE!');
  } else {
    console.log('\n⚠️ Tables not yet found in Supabase schema cache.');
    console.log('Please execute supabase/complete_database_migration.sql in the Supabase SQL editor:');
    console.log(`👉 https://supabase.com/dashboard/project/tgpxcqazpifkifsnfmmz/sql/new`);
  }
}

verify();
