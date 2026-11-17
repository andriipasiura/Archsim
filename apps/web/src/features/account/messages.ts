export const MESSAGES = {
  signInFailed: 'Sign-in failed. Please try again.',
  signInUnavailable:
    'Sign-in is not configured on this server, so diagrams can only be kept in this browser.',
  sessionExpired: 'Your session has expired. Sign in again to save.',
  movedToAccount: 'Your diagram was saved to your account.',
  conflict: (error: string) =>
    `${error}. Open it from "My diagrams" to get the latest, or use "Save as new copy" to keep this one.`,
  deletedElsewhere:
    'This diagram no longer exists in your account. Save again to store it as a new diagram.',
  requestFailed: (error: string) => `Request failed: ${error}`,
} as const;
