type EntitlementReason = 
  | 'credits_low'
  | 'video_access'
  | 'film_studio'
  | 'premium_models'
  | 'private_content'
  | 'batch_generation';

export function redirectToUpgrade(reason: EntitlementReason): void {
  window.location.href = `/pricing?upgrade=1&reason=${reason}`;
}

export function getUpgradeUrl(reason: EntitlementReason): string {
  return `/pricing?upgrade=1&reason=${reason}`;
}

export function checkEntitlement(
  featureFlags: Record<string, boolean> | null | undefined,
  requiredFlag: string
): boolean {
  if (!featureFlags) return false;
  return featureFlags[requiredFlag] === true;
}

export function requireEntitlement(
  featureFlags: Record<string, boolean> | null | undefined,
  requiredFlag: string,
  reason: EntitlementReason
): boolean {
  const hasEntitlement = checkEntitlement(featureFlags, requiredFlag);
  if (!hasEntitlement) {
    redirectToUpgrade(reason);
    return false;
  }
  return true;
}
