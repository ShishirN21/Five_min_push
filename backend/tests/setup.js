process.env.NODE_ENV   = 'test';
process.env.DB_PATH    = ':memory:';
process.env.JWT_SECRET = 'test_secret_that_is_long_enough_for_hs256_algorithm_padding';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.ALLOWED_ORIGINS = 'http://localhost:8765';
