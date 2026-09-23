export type TeamReviewStatus = 'pending' | 'approved' | 'flagged_duplicate' | 'merged' | 'rejected';

export interface Team {
  id: string;
  team_name: string;
  canonical_name?: string;
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
  track?: string | null;
  review_status?: TeamReviewStatus;
  duplicate_notes?: string | null;
  duplicate_match_team_id?: string | null;
  merged_into_team_id?: string | null;
}

export interface Member {
  id: string;
  team_id: string;
  name: string;
  phone: string;
  normalized_phone?: string;
  email: string;
  normalized_email?: string;
  present: boolean;
  created_at: string;
}

export type PriorityLevel = 'normal' | 'important' | 'urgent';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: PriorityLevel;
  published: boolean;
  created_at: string;
}

export interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  tag: string;
  color: string;
  text_color?: string;
  order_index: number;
  created_at?: string;
}

export type ScanPurpose = 'registration' | 'breakfast' | 'lunch' | 'dinner' | 'coffee' | string;
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type LimitRule = 'once_per_team' | 'per_present_member' | 'unlimited';

export interface ScanEvent {
  id: string;
  title: string;
  description?: string | null;
  limit_rule: LimitRule;
  color: string;
  text_color?: string;
  icon?: string;
  active: boolean;
  order_index?: number;
  created_at: string;
}

export interface ScanEventRecord {
  id: string;
  event_id: string;
  team_id: string;
  count: number;
  present_member_ids?: string[] | null;
  scanned_at: string;
}

export interface ScanResult {
  success: boolean;
  error_code?:
    | 'INVALID_QR'
    | 'NOT_CHECKED_IN'
    | 'MEAL_LIMIT_REACHED'
    | 'LIMIT_REACHED'
    | 'ALREADY_COMPLETED'
    | 'NO_PRESENT_MEMBERS'
    | 'ALREADY_REGISTERED'
    | 'INVALID_MEAL_TYPE'
    | 'INVALID_EVENT'
    | 'UNAUTHORIZED'
    | 'SERVER_ERROR'
    | 'TOKEN_REVOKED'
    | 'TEAM_MERGED'
    | 'TEAM_REJECTED';
  message: string;
  team_id?: string;
  team_name?: string;
  college?: string;
  checked_in?: boolean;
  meal_type?: MealType | string;
  event_id?: string;
  event_title?: string;
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

// =============================================================================
// Event & Multi-Session Attendance Schema
// =============================================================================

export type RegistrationStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'WAITLISTED';
export type UserType = 'STUDENT' | 'PROFESSIONAL' | 'FACULTY' | 'OTHER';
export type EventStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export interface Event {
  id: string;
  title: string;
  date: string | Date;
  status: EventStatus | string;
  registrations?: Registration[];
  attendanceInstances?: AttendanceInstance[];
}

export interface RegistrationTeamMember {
  name: string;
  email: string;
  phone?: string;
  usn?: string;
  role?: string;
}

export interface Registration {
  id: string;
  status: RegistrationStatus | string;
  userType: UserType | string;
  fullName: string;
  email: string;
  phone?: string | null;
  usn?: string | null;
  semester?: number | null;
  department?: string | null;
  section?: string | null;
  customFieldResponse?: string | null;
  teamName?: string | null;
  teamMembers?: RegistrationTeamMember[] | Record<string, any> | null;
  paymentScreenshot?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  attendanceCode?: string | null;
  attended: boolean;
  eventId: string;
  event?: Event;
  attendanceRecords?: AttendanceRecord[];
}

export interface AttendanceInstance {
  id: string;
  eventId: string;
  name: string;
  time?: string | Date | null;
  createdAt: string | Date;
  prerequisiteInstanceId?: string | null;
  event?: Event;
  prerequisite?: AttendanceInstance | null;
  dependents?: AttendanceInstance[];
  records?: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: string;
  attendanceInstanceId: string;
  registrationId: string;
  memberEmail: string;
  attendedAt: string | Date;
  instance?: AttendanceInstance;
  registration?: Registration;
}
