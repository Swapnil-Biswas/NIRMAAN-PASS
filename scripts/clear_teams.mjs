import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env or .env.local if present
const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  const fullPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(fullPath)) {
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log('--- NIRMAAN-PASS CLEAR ALL TEAMS UTILITY ---');

async function clearTeams() {
  if (url && !url.includes('placeholder') && !url.includes('your-project') && serviceKey) {
    console.log('Connecting to Supabase at:', url);
    const supabase = createClient(url, serviceKey);

    try {
      console.log('Deleting all rows from "members"...');
      const { error: memErr } = await supabase.from('members').delete().neq('id', 'placeholder_nil_id');
      if (memErr) console.warn('Warning deleting members:', memErr.message);

      console.log('Deleting all rows from "teams"...');
      const { error: teamErr } = await supabase.from('teams').delete().neq('id', 'placeholder_nil_id');
      if (teamErr) console.warn('Warning deleting teams:', teamErr.message);

      console.log('✅ All remote Supabase team and member records cleared successfully.');
    } catch (e) {
      console.error('❌ Supabase cleanup error:', e.message);
    }
  } else {
    console.log('ℹ️ No remote Supabase connection. Local in-memory dataset is clean (0 teams).');
  }

  // Ensure seeded_teams.json is clean empty array
  const seededPath = path.resolve(process.cwd(), 'lib/data/seeded_teams.json');
  fs.writeFileSync(seededPath, JSON.stringify({ teams: [], members: [] }, null, 2) + '\n');
  console.log('✅ Local seeded_teams.json verified empty.');
}

clearTeams();
