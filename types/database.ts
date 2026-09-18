export type PriorityLevel = 'normal' | 'important' | 'urgent';

export interface Team {
  id: string;
  team_name: string;
  college: string;
  auth_id: string | null;
  qr_token: string;
  checked_in: boolean;
  breakfast_count: number;
  lunch_count: number;
  dinner_count: number;
  coffee_count: number;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  team_id: string;
  name: string;
  phone: string;
  email: string;
  present: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: PriorityLevel;
  published: boolean;
  created_at: string;
}

export type ScanPurpose = 'registration' | 'breakfast' | 'lunch' | 'dinner' | 'coffee';
export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface ScanResult {
  success: boolean;
  error_code?:
    | 'INVALID_QR'
    | 'NOT_CHECKED_IN'
    | 'MEAL_LIMIT_REACHED'
    | 'NO_PRESENT_MEMBERS'
    | 'ALREADY_REGISTERED'
    | 'INVALID_MEAL_TYPE'
    | 'UNAUTHORIZED'
    | 'SERVER_ERROR';
  message: string;
  team_id?: string;
  team_name?: string;
  college?: string;
  checked_in?: boolean;
  meal_type?: MealType | string;
  present_count?: number;
  current_count?: number;
  new_count?: number;
  remaining_count?: number;
  total_members?: number;
  members?: Member[];
}

export interface EventStatistics {
  total_teams: number;
  checked_in_teams: number;
  total_students: number;
  present_students: number;
  breakfast_served: number;
  lunch_served: number;
  dinner_served: number;
  total_coffee: number;
}

export interface TeamWithMembers extends Team {
  members: Member[];
  present_members_count: number;
  total_members_count: number;
}
