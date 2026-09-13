/**
 * Loads environment files the same way Next.js does, so a script and the site
 * never disagree about which database they are pointed at.
 * Precedence: .env.local wins over .env, and anything already in the real
 * environment wins over both.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });
