import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if present
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      const val = v.join('=').trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k.trim()]) {
        process.env[k.trim()] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log('\n🧹 --- NIRMAAN 2026: RESET ATTENDANCE & TEST SCANS ---');

// 1. Reset seeded_teams.json locally so memory store is clean
const datasetPath = path.join(__dirname, '..', 'lib', 'data', 'seeded_teams.json');
if (fs.existsSync(datasetPath)) {
  const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  for (const team of data.teams) {
    team.checked_in = false;
    team.breakfast_count = 0;
    team.lunch_count = 0;
    team.dinner_count = 0;
    team.coffee_count = 0;
  }
  for (const member of data.members) {
    member.present = false;
  }
  fs.writeFileSync(datasetPath, JSON.stringify(data, null, 2));
  console.log(`✅ Reset local dataset (${data.teams.length} teams, ${data.members.length} members) back to 0 counts.`);
}

// 2. If Supabase is configured, reset Supabase tables as well
if (supabaseUrl && !supabaseUrl.includes('placeholder') && !supabaseUrl.includes('your-project') && supabaseKey) {
  console.log('🌐 Connecting to Supabase at:', supabaseUrl);
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('⏳ Resetting teams in Supabase...');
    const { error: tErr } = await supabase
      .from('teams')
      .update({
        checked_in: false,
        breakfast_count: 0,
        lunch_count: 0,
        dinner_count: 0,
        coffee_count: 0,
        updated_at: new Date().toISOString(),
      })
      .neq('id', 'placeholder');

    if (tErr) {
      console.error('⚠️ Teams reset note:', tErr.message);
    } else {
      console.log('✅ Supabase teams table reset.');
    }

    console.log('⏳ Resetting members attendance in Supabase...');
    const { error: mErr } = await supabase
      .from('members')
      .update({ present: false })
      .neq('id', 'placeholder');

    if (mErr) {
      console.error('⚠️ Members reset note:', mErr.message);
    } else {
      console.log('✅ Supabase members table reset (all set to absent).');
    }

    // Clear custom scan records if table exists
    try {
      await supabase.from('custom_scan_records').delete().neq('id', 'placeholder');
      console.log('✅ Supabase custom scan records cleared.');
    } catch {}
  } catch (err) {
    console.error('❌ Supabase reset error:', err.message);
  }
} else {
  console.log('ℹ️  No remote Supabase credentials detected; standalone memory dataset has been reset.');
}

console.log('\n🎉 ALL TEST SCANS & ON-DESK ATTENDANCE HAVE BEEN UNDONE!\n');
