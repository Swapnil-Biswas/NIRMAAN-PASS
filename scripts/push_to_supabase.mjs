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

console.log('\n🚀 --- NIRMAAN 2026: SUPABASE DATA SYNC ---');

if (!supabaseUrl || supabaseUrl.includes('placeholder') || supabaseUrl.includes('your-project')) {
  console.error('\n❌ Error: NEXT_PUBLIC_SUPABASE_URL is missing or using a placeholder.');
  console.log('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local\n');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('\n❌ Error: SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is missing in .env.local.');
  process.exit(1);
}

console.log('🌐 Target Supabase Instance:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function pushData() {
  const datasetPath = path.join(__dirname, '..', 'lib', 'data', 'seeded_teams.json');
  if (!fs.existsSync(datasetPath)) {
    console.error('❌ Error: seeded_teams.json file not found at:', datasetPath);
    process.exit(1);
  }

  const { teams, members } = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  console.log(`\n📦 Loaded ${teams.length} teams and ${members.length} members from official dataset.`);

  // 1. Verify connection
  console.log('\n⏳ Step 1: Testing Supabase connection...');
  const { error: testError } = await supabase.from('teams').select('id').limit(1);
  if (testError && testError.code !== 'PGRST116') {
    console.warn('⚠️  Note on table query:', testError.message);
  } else {
    console.log('✅ Connection established.');
  }

  // 2. Insert / Upsert Teams
  console.log(`\n⏳ Step 2: Syncing ${teams.length} teams into 'teams' table...`);
  const teamsPayload = teams.map((t) => ({
    id: t.id,
    team_name: t.team_name,
    canonical_name: t.canonical_name || null,
    college: t.college,
    track: t.track || 'Open Innovation',
    qr_token: t.qr_token,
    checked_in: t.checked_in || false,
    breakfast_count: t.breakfast_count || 0,
    lunch_count: t.lunch_count || 0,
    dinner_count: t.dinner_count || 0,
    coffee_count: t.coffee_count || 0,
    review_status: t.review_status || 'approved',
    duplicate_notes: t.duplicate_notes || null,
    created_at: t.created_at || new Date().toISOString(),
    updated_at: t.updated_at || new Date().toISOString(),
  }));

  const { error: teamsError } = await supabase
    .from('teams')
    .upsert(teamsPayload, { onConflict: 'id' });

  if (teamsError) {
    console.error('❌ Failed to upsert teams:', teamsError.message);
    console.log('Tip: If some columns do not exist yet, run supabase/complete_database_migration.sql first.');
    process.exit(1);
  }
  console.log(`✅ Successfully synced all ${teams.length} teams.`);

  // 3. Insert / Upsert Members
  console.log(`\n⏳ Step 3: Syncing ${members.length} members into 'members' table...`);
  const membersPayload = members.map((m) => ({
    id: m.id,
    team_id: m.team_id,
    name: m.name,
    phone: m.phone || '',
    normalized_phone: m.normalized_phone || '',
    email: m.email || '',
    normalized_email: m.normalized_email || '',
    present: m.present || false,
    created_at: m.created_at || new Date().toISOString(),
  }));

  // Batch insert members in chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < membersPayload.length; i += chunkSize) {
    const chunk = membersPayload.slice(i, i + chunkSize);
    const { error: memError } = await supabase
      .from('members')
      .upsert(chunk, { onConflict: 'id' });

    if (memError) {
      console.error(`❌ Failed to upsert members chunk ${i / chunkSize + 1}:`, memError.message);
      process.exit(1);
    }
  }

  console.log(`✅ Successfully synced all ${members.length} members.`);

  console.log('\n🎉 ALL 50 TEAMS & 184 PARTICIPANTS ARE NOW LIVE IN SUPABASE!\n');
}

pushData().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
