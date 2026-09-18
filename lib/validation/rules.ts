import { Member, Team, MealType, ScanResult } from '@/types/database';

/**
 * Calculates meal entitlement based strictly on physically present members
 */
export function calculateMealEntitlement(members: Member[]): number {
  return members.filter((m) => m.present).length;
}

/**
 * Validates whether a team is eligible for an additional meal serving
 */
export function validateMealEligibility(
  team: Team,
  members: Member[],
  mealType: MealType
): { eligible: boolean; presentCount: number; currentCount: number; message: string; errorCode?: ScanResult['error_code'] } {
  if (!team.checked_in) {
    return {
      eligible: false,
      presentCount: 0,
      currentCount: 0,
      message: 'Team not registered at the event desk. Please visit registration desk.',
      errorCode: 'NOT_CHECKED_IN',
    };
  }

  const presentCount = calculateMealEntitlement(members);
  if (presentCount === 0) {
    return {
      eligible: false,
      presentCount: 0,
      currentCount: 0,
      message: 'No team members marked present. Please update attendance at registration desk.',
      errorCode: 'NO_PRESENT_MEMBERS',
    };
  }

  let currentCount = 0;
  if (mealType === 'breakfast') {
    currentCount = team.breakfast_count;
  } else if (mealType === 'lunch') {
    currentCount = team.lunch_count;
  } else if (mealType === 'dinner') {
    currentCount = team.dinner_count;
  } else {
    return {
      eligible: false,
      presentCount,
      currentCount: 0,
      message: 'Invalid meal type specified.',
      errorCode: 'INVALID_MEAL_TYPE',
    };
  }

  if (currentCount >= presentCount) {
    const mealName = mealType.charAt(0).toUpperCase() + mealType.slice(1);
    return {
      eligible: false,
      presentCount,
      currentCount,
      message: `${mealName} limit reached — ${currentCount}/${presentCount} served.`,
      errorCode: 'MEAL_LIMIT_REACHED',
    };
  }

  return {
    eligible: true,
    presentCount,
    currentCount,
    message: `Eligible for ${mealType} (${currentCount + 1}/${presentCount})`,
  };
}

/**
 * Validates member fields
 */
export function validateMemberInput(name: string, phone: string, email: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Member name is required' };
  }
  if (!phone || phone.trim().length < 8) {
    return { valid: false, error: 'Valid phone number is required' };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { valid: false, error: 'Valid email address is required' };
  }
  return { valid: true };
}
