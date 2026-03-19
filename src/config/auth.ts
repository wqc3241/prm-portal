const authConfig = {
  jwtSecret: process.env.JWT_SECRET || 'default-dev-secret-change-in-production-min32chars',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'default-dev-refresh-secret-change-in-prod-32c',
  accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '1h',
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  passwordResetExpiry: process.env.PASSWORD_RESET_EXPIRY || '1h',
  passwordResetExpiryMs: 60 * 60 * 1000, // 1 hour in ms
};

export default authConfig;
