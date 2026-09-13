import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
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
