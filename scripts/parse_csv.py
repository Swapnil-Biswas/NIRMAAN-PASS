import csv
import json
import hashlib
import re

def clean_name(s):
    s = s.strip().strip('"')
    return re.sub(r',\s*\d+$', '', s).strip()

def infer_college(members):
    for m in members:
        email = m.get("email", "").lower()
        if "@" in email:
            domain = email.split("@")[1]
            if "bmsit" in domain:
                return "BMS Institute of Technology"
            if "nmit" in domain:
                return "Nitte Meenakshi Institute of Technology"
            if "kletech" in domain:
                return "KLE Technological University"
            if "bvrit" in domain:
                return "BVRIT Hyderabad"
            if "sairam" in domain:
                return "Sri Sairam Engineering College"
            if "rvce" in domain:
                return "RV College of Engineering"
            if "pes" in domain:
                return "PES University"
            if "msrit" in domain or "ramaiah" in domain:
                return "Ramaiah Institute of Technology"
    return "Engineering Institution"

def main():
    teams = []
    members_list = []
    current_team = None
    team_idx = 0
    member_idx = 0

    with open("NIRMAAN_2026_MastryHub_Submission_of_Round_1_PPT.csv", mode="r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if not any(row):
                continue
            team_name = row[0].strip() if len(row) > 0 else ""
            captain = row[1].strip() if len(row) > 1 else ""
            member_name = clean_name(row[2]) if len(row) > 2 else ""
            email = row[3].strip() if len(row) > 3 else ""
            phone = row[4].strip() if len(row) > 4 else ""

            if team_name:
                team_idx += 1
                token_hash = hashlib.sha256(f"nirmaan_2026_{team_idx}_{team_name}".encode()).hexdigest()[:12]
                clean_slug = re.sub(r"[^a-zA-Z0-9]", "_", team_name.lower())[:10].strip("_")
                qr_token = f"nirmaan_{clean_slug}_{token_hash}"

                current_team = {
                    "id": f"team-nir-{team_idx:03d}",
                    "team_name": team_name,
                    "captain": captain,
                    "college": "Engineering Institution",
                    "auth_id": None,
                    "qr_token": qr_token,
                    "checked_in": False,
                    "breakfast_count": 0,
                    "lunch_count": 0,
                    "dinner_count": 0,
                    "coffee_count": 0,
                    "created_at": "2026-09-18T00:00:00.000Z",
                    "updated_at": "2026-09-18T00:00:00.000Z",
                    "_members": []
                }
                teams.append(current_team)

            if current_team and (member_name or email):
                member_idx += 1
                num_mem = len(current_team["_members"])
                display_name = member_name if member_name else (captain if num_mem == 0 else f"Member {num_mem + 1}")
                m_obj = {
                    "id": f"m-nir-{member_idx:04d}",
                    "team_id": current_team["id"],
                    "name": display_name,
                    "phone": phone or "+91 90000 00000",
                    "email": email or f"participant_{member_idx}@nirmaan.org",
                    "present": False,
                    "created_at": "2026-09-18T00:00:00.000Z"
                }
                current_team["_members"].append(m_obj)
                members_list.append(m_obj)

    # Infer colleges and clean internal temp fields
    for t in teams:
        t["college"] = infer_college(t["_members"])
        del t["_members"]

    # Pre-seed first 3 demo teams with checked-in test data for demo convenience
    teams[0]["checked_in"] = True
    teams[0]["breakfast_count"] = 3
    teams[0]["lunch_count"] = 2
    teams[0]["coffee_count"] = 14
    # Mark first 3 members of team 0 present
    m_t0 = [m for m in members_list if m["team_id"] == teams[0]["id"]]
    for i, m in enumerate(m_t0[:3]):
        m["present"] = True

    # SQL seed file for Supabase
    sql_lines = [
        "-- NIRMAAN 2026 Seed Data: 289 Teams, 908 Members",
        "BEGIN;"
    ]

    for t in teams:
        name_esc = t["team_name"].replace("'", "''")
        col_esc = t["college"].replace("'", "''")
        chk = "true" if t["checked_in"] else "false"
        sql_lines.append(
            f"INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) "
            f"VALUES ('{t['id']}', '{name_esc}', '{col_esc}', '{t['qr_token']}', {chk}, {t['breakfast_count']}, {t['lunch_count']}, {t['dinner_count']}, {t['coffee_count']}) "
            f"ON CONFLICT (qr_token) DO NOTHING;"
        )

    for m in members_list:
        name_esc = m["name"].replace("'", "''")
        phone_esc = m["phone"].replace("'", "''")
        email_esc = m["email"].replace("'", "''")
        prs = "true" if m["present"] else "false"
        sql_lines.append(
            f"INSERT INTO public.members (id, team_id, name, phone, email, present) "
            f"VALUES ('{m['id']}', '{m['team_id']}', '{name_esc}', '{phone_esc}', '{email_esc}', {prs}) "
            f"ON CONFLICT (id) DO NOTHING;"
        )

    sql_lines.append("COMMIT;")

    with open("supabase/seed.sql", "w", encoding="utf-8") as out_sql:
        out_sql.write("\n".join(sql_lines))

    with open("lib/data/seeded_teams.json", "w", encoding="utf-8") as out_t:
        json.dump({"teams": teams, "members": members_list}, out_t, indent=2)

    print(f"Generated lib/data/seeded_teams.json and supabase/seed.sql ({len(teams)} teams, {len(members_list)} members)")

if __name__ == "__main__":
    main()
