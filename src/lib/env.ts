/**
 * Environment access. Reads are lazy so that a missing optional variable never
 * breaks an unrelated page at build time, and required ones fail loudly the
 * first time something actually needs them.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example for what it should contain.`,
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  get sessionSecret() {
    return required('SESSION_SECRET');
  },

  /**
   * Firebase's password-hash parameters. Present only while legacy hashes remain.
   * Returns undefined when not configured, which makes legacy verification fail
   * closed (the user is told to reset) rather than throwing on every login.
   */
  get firebaseHash() {
    const signerKey = optional('FIREBASE_HASH_SIGNER_KEY');
    const saltSeparator = optional('FIREBASE_HASH_SALT_SEPARATOR');
    if (!signerKey || !saltSeparator) return undefined;
    return {
      signerKey,
      saltSeparator,
      rounds: Number(optional('FIREBASE_HASH_ROUNDS') ?? 8),
      memCost: Number(optional('FIREBASE_HASH_MEM_COST') ?? 14),
    };
  },

  get mail() {
    return {
      driver: (optional('MAIL_DRIVER') ?? 'console') as 'smtp' | 'console',
      from: optional('MAIL_FROM') ?? 'Sint-Jorisschool <noreply@sintjorisschool.be>',
      host: optional('SMTP_HOST'),
      port: Number(optional('SMTP_PORT') ?? 587),
      user: optional('SMTP_USER'),
      password: optional('SMTP_PASSWORD'),
    };
  },

  get storage() {
    const endpoint = optional('S3_ENDPOINT');
    const bucket = optional('S3_BUCKET');
    const accessKeyId = optional('S3_ACCESS_KEY_ID');
    const secretAccessKey = optional('S3_SECRET_ACCESS_KEY');
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return undefined;
    return {
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
      region: optional('S3_REGION') ?? 'auto',
      publicBaseUrl: optional('NEXT_PUBLIC_MEDIA_BASE_URL') ?? '',
    };
  },

  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
};
