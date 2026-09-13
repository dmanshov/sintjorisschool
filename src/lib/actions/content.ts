'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { CONTENT_FIELDS, CONTENT_ID, type ContentField } from '@/lib/data/content';
import { isStorageConfigured, uploadFile } from '@/lib/storage';
import { content } from '@db/schema';

export type ActionState = { error?: string; success?: string } | null;

function isContentField(value: unknown): value is ContentField {
  return typeof value === 'string' && value in CONTENT_FIELDS;
}

/** Saves one text field of the CMS. The field name is checked against an allowlist. */
export async function updateContentFieldAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const field = formData.get('field');
  const value = String(formData.get('value') ?? '');

  if (!isContentField(field)) return { error: 'Onbekend veld.' };
  if (value.length > 20000) return { error: 'Deze tekst is te lang.' };

  await db
    .update(content)
    .set({ [field]: value || null, updatedAt: new Date(), updatedById: admin.id })
    .where(eq(content.id, CONTENT_ID));

  revalidateContentPages();
  return { success: 'De aanpassingen werden opgeslagen.' };
}

/** Saves several fields at once, for the grouped edit forms. */
export async function updateContentFieldsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const patch: Record<string, string | null> = {};

  for (const [key, raw] of formData.entries()) {
    if (!isContentField(key)) continue;
    const value = String(raw);
    if (value.length > 20000) return { error: `De tekst voor "${CONTENT_FIELDS[key].label}" is te lang.` };
    patch[key] = value || null;
  }

  if (Object.keys(patch).length === 0) return { error: 'Er was niets om op te slaan.' };

  await db
    .update(content)
    .set({ ...patch, updatedAt: new Date(), updatedById: admin.id })
    .where(eq(content.id, CONTENT_ID));

  revalidateContentPages();
  return { success: 'De aanpassingen werden opgeslagen.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hot meals: which month is open, which dates within it, and the menu PDF.
// ─────────────────────────────────────────────────────────────────────────────

export async function setMealMonthAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const month = String(formData.get('maaltijdMaand') ?? '').trim();

  await db
    .update(content)
    .set({ maaltijdMaand: month || null, updatedAt: new Date(), updatedById: admin.id })
    .where(eq(content.id, CONTENT_ID));

  revalidateContentPages();
  return { success: month ? `Bestelmaand ingesteld op ${month}.` : 'Bestelmaand gewist.' };
}

/** Opens one date for meal orders. Stored as ISO yyyy-mm-dd so it sorts correctly. */
export async function addMealDateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const date = String(formData.get('date') ?? '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Kies een geldige datum.' };

  await db
    .update(content)
    .set({
      // array_append only if absent, then sorted, so the parent form always
      // shows the dates in order.
      maaltijdDatums: sql`(
        select coalesce(array_agg(d order by d), '{}')
        from (select distinct unnest(array_append(${content.maaltijdDatums}, ${date}::text)) as d) s
      )`,
      updatedAt: new Date(),
      updatedById: admin.id,
    })
    .where(eq(content.id, CONTENT_ID));

  revalidateContentPages();
  return { success: 'De geselecteerde datum is nu toegevoegd.' };
}

export async function removeMealDateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const date = String(formData.get('date') ?? '').trim();

  await db
    .update(content)
    .set({
      maaltijdDatums: sql`array_remove(${content.maaltijdDatums}, ${date}::text)`,
      updatedAt: new Date(),
      updatedById: admin.id,
    })
    .where(eq(content.id, CONTENT_ID));

  revalidateContentPages();
  return { success: 'De datum werd verwijderd.' };
}

/**
 * Closing the month: clear the open dates so no further orders can be placed.
 * This is the "Bestellingen afsluiten" button, and it is what makes
 * placeOrderAction reject late meal orders.
 */
export async function closeMealOrdersAction(): Promise<ActionState> {
  const admin = await requireAdmin();
  await db
    .update(content)
    .set({ maaltijdDatums: [], updatedAt: new Date(), updatedById: admin.id })
    .where(eq(content.id, CONTENT_ID));

  revalidateContentPages();
  return { success: 'De bestellingen werden afgesloten. Er kunnen geen nieuwe maaltijden besteld worden.' };
}

/** Uploads a menu PDF and appends it; the newest is the one parents are shown. */
export async function uploadMealMenuAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const file = formData.get('menu');

  if (!(file instanceof File) || file.size === 0) return { error: 'Kies een bestand.' };
  if (!isStorageConfigured()) {
    return {
      error:
        'Bestanden opladen is nog niet geconfigureerd. Stel de S3_* variabelen in, of plaats de link rechtstreeks in het tekstveld.',
    };
  }

  let url: string;
  try {
    url = await uploadFile(file, 'document', 'maaltijden');
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Het opladen is mislukt.' };
  }

  await db
    .update(content)
    .set({
      maaltijd: sql`array_append(${content.maaltijd}, ${url}::text)`,
      updatedAt: new Date(),
      updatedById: admin.id,
    })
    .where(eq(content.id, CONTENT_ID));

  revalidateContentPages();
  return { success: 'Het bestand werd met succes opgeladen.' };
}

/** Uploads a supply list PDF for one classroom. */
export async function uploadBenodigdhedenAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const field = formData.get('field');
  const file = formData.get('document');

  if (!isContentField(field) || !field.startsWith('benodigdheden')) {
    return { error: 'Onbekend veld.' };
  }
  if (!(file instanceof File) || file.size === 0) return { error: 'Kies een bestand.' };
  if (!isStorageConfigured()) {
    return { error: 'Bestanden opladen is nog niet geconfigureerd. Stel de S3_* variabelen in.' };
  }

  let url: string;
  try {
    url = await uploadFile(file, 'document', 'benodigdheden');
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Het opladen is mislukt.' };
  }

  await db
    .update(content)
    .set({ [field]: url, updatedAt: new Date(), updatedById: admin.id })
    .where(eq(content.id, CONTENT_ID));

  revalidateContentPages();
  return { success: 'Het bestand werd met succes opgeladen.' };
}

function revalidateContentPages(): void {
  for (const path of ['/', '/home', '/onzeSchool', '/praktisch', '/profiel', '/inschrijven', '/admin']) {
    revalidatePath(path);
  }
}
