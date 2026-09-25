function concurrencyLimit(maximum: number) {
  let active = 0;
  return () => {
    if (active >= maximum) return null;
    active += 1;
    return () => { active -= 1; };
  };
}

// Capacity recovers as requests finish, even when no trusted client IP is available.
export const takePasskeyOptionsSlot = concurrencyLimit(8);
export const takePasskeyVerificationSlot = concurrencyLimit(8);
