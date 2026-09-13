import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { csvFilename, listOrders, ordersToCsv } from '@/lib/data/orders';
import { ORDER_STATUSES, ORDER_TYPES, type OrderStatus, type OrderType } from '@db/schema';

/**
 * CSV export of orders.
 *
 * Replaces the old `downloadOrdersAsCSV` custom action, which built the file in
 * the browser from documents the client had already downloaded. Doing it here
 * means the export is authorised (a teacher only ever gets their own classes),
 * the values are escaped, and the file is never limited by what the browser had
 * managed to load.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (!user.admin && !user.teacher)) {
    return new NextResponse('Geen toegang.', { status: 403 });
  }

  const url = new URL(request.url);
  const typeParam = url.searchParams.get('type');
  const statusParam = url.searchParams.get('status');
  const month = url.searchParams.get('month');

  if (typeParam && !(ORDER_TYPES as readonly string[]).includes(typeParam)) {
    return new NextResponse('Onbekend type bestelling.', { status: 400 });
  }
  if (statusParam && !(ORDER_STATUSES as readonly string[]).includes(statusParam)) {
    return new NextResponse('Onbekende status.', { status: 400 });
  }

  const rows = await listOrders({
    type: (typeParam as OrderType | null) ?? undefined,
    status: (statusParam as OrderStatus | null) ?? undefined,
    consumptionMonth: month ?? undefined,
    // A teacher's export is scoped to their own classes, whatever the query says.
    classrooms: user.admin ? undefined : (user.teacherClassroom ?? []),
    limit: 20000,
  });

  const filename = csvFilename((typeParam as OrderType | null) ?? 'Alle', statusParam ?? undefined);

  return new NextResponse(ordersToCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
