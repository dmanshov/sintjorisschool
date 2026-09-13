import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { safeRead, type DbFailure } from '@/lib/db-status';
import { content, type Content } from '@db/schema';

export const CONTENT_ID = 'singleton';

/**
 * The editable site text. Cached per request: a page that renders the team list,
 * the meal notice and the class supply lists reads it once.
 */
export const getContent = cache(async (): Promise<Content> => {
  const rows = await db.select().from(content).where(eq(content.id, CONTENT_ID)).limit(1);
  const row = rows[0];
  if (row) return row;

  // An empty database still has to render. Insert the row rather than returning a
  // fake one, so the admin screen has something to edit.
  const inserted = await db
    .insert(content)
    .values({ id: CONTENT_ID })
    .onConflictDoNothing()
    .returning();
  return inserted[0] ?? (await db.select().from(content).where(eq(content.id, CONTENT_ID)).limit(1))[0]!;
});

/** The fields the admin screen can edit, grouped the way the old app grouped them. */
export const CONTENT_FIELDS = {
  welkom: { label: 'Welkomsttekst', multiline: true },
  inschrijvingen: { label: 'Inschrijvingen', multiline: true },
  schoolreglement: { label: 'Schoolreglement (link of tekst)', multiline: true },

  teamFoto: { label: 'Teamfoto (URL)', multiline: false },
  teamDirecteur: { label: 'Directeur', multiline: true },
  teamAdministratie: { label: 'Administratie en preventie', multiline: true },
  teamKleuterschool: { label: 'Leerkrachtenteam kleuterschool', multiline: true },
  teamLagereSchool: { label: 'Leerkrachtenteam lagere school', multiline: true },
  teamAmbulant: { label: 'Ambulante leerkrachten', multiline: true },
  teamZorg: { label: 'Zorg', multiline: true },
  teamGym: { label: 'Gymleerkracht', multiline: true },
  teamOnderhoud: { label: 'Onderhoudspersoneel', multiline: true },

  bestuurVoorzitter: { label: 'Schoolbestuur — voorzitter', multiline: true },
  bestuurLeden: { label: 'Schoolbestuur — leden', multiline: true },

  clbCoordinator: { label: 'CLB — vestigingscoördinator', multiline: true },
  clbMedewerkers: { label: 'CLB — medewerkers', multiline: true },

  ondersteuningVestiging: { label: 'Ondersteuningsnetwerk — vestiging', multiline: true },
  ondersteuningVoorwaarden: { label: 'Ondersteuningsnetwerk — voorwaarden', multiline: true },

  opvang: { label: 'Buitenschoolse opvang', multiline: true },
  ziekte: { label: 'Ziekte en medicatie', multiline: true },

  maaltijdMaand: { label: 'Maaltijden — bestelmaand', multiline: false },
  maaltijdBericht: { label: 'Maaltijden — bericht aan ouders', multiline: true },

  benodigdhedenKK0: { label: 'Benodigdheden KK0', multiline: true },
  benodigdhedenKK1: { label: 'Benodigdheden KK1', multiline: true },
  benodigdhedenKK2: { label: 'Benodigdheden KK2', multiline: true },
  benodigdhedenKK3: { label: 'Benodigdheden KK3', multiline: true },
  benodigdhedenL1: { label: 'Benodigdheden L1', multiline: true },
  benodigdhedenL2: { label: 'Benodigdheden L2', multiline: true },
  benodigdhedenL3: { label: 'Benodigdheden L3', multiline: true },
  benodigdhedenL4: { label: 'Benodigdheden L4', multiline: true },
  benodigdhedenL5: { label: 'Benodigdheden L5', multiline: true },
  benodigdhedenL6: { label: 'Benodigdheden L6', multiline: true },
} as const satisfies Record<string, { label: string; multiline: boolean }>;

export type ContentField = keyof typeof CONTENT_FIELDS;
export const CONTENT_FIELD_NAMES = Object.keys(CONTENT_FIELDS) as ContentField[];

/**
 * Every content field empty. Used when the database cannot answer, so the public
 * pages still render their built-in copy instead of returning a 500 — each
 * <CmsText> on those pages already carries a `fallback`.
 *
 * Written out in full rather than built dynamically, so that adding a column to
 * `content` without adding it here is a compile error rather than a surprise at
 * runtime.
 */
function emptyContent(): Content {
  return {
    id: CONTENT_ID,
    maaltijd: [],
    maaltijdDatums: [],
    welkom: null,
    inschrijvingen: null,
    schoolreglement: null,
    teamFoto: null,
    teamDirecteur: null,
    teamAdministratie: null,
    teamKleuterschool: null,
    teamLagereSchool: null,
    teamAmbulant: null,
    teamZorg: null,
    teamGym: null,
    teamOnderhoud: null,
    bestuurVoorzitter: null,
    bestuurLeden: null,
    clbCoordinator: null,
    clbMedewerkers: null,
    ondersteuningVestiging: null,
    ondersteuningVoorwaarden: null,
    opvang: null,
    ziekte: null,
    maaltijdMaand: null,
    maaltijdBericht: null,
    benodigdhedenKK0: null,
    benodigdhedenKK1: null,
    benodigdhedenKK2: null,
    benodigdhedenKK3: null,
    benodigdhedenL1: null,
    benodigdhedenL2: null,
    benodigdhedenL3: null,
    benodigdhedenL4: null,
    benodigdhedenL5: null,
    benodigdhedenL6: null,
    updatedAt: new Date(0),
    updatedById: null,
  };
}

/**
 * The editable text, or blank content plus a reason when the database is not
 * reachable or not yet migrated. Public pages use this; anything behind a login
 * uses `getContent` and is allowed to fail loudly.
 */
export async function getContentSafe(): Promise<{ content: Content; failure: DbFailure }> {
  const { value, failure } = await safeRead('content', getContent, emptyContent());
  return { content: value, failure };
}
