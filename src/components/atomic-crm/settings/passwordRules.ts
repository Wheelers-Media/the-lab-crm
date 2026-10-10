export const MIN_PASSWORD_LENGTH = 8;

/** What is wrong with a new password, or null when it can be saved. */
export const passwordProblem = (
  password: string,
  confirm: string,
): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return "The two passwords don't match.";
  return null;
};
