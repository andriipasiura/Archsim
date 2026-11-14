export const MESSAGES = {
  numberRequired: 'Enter a number',
  integerRequired: 'Enter a whole number',
  minimum: (min: number) => `Minimum is ${min}`,
  maximum: (max: number) => `Maximum is ${max}`,
} as const;
