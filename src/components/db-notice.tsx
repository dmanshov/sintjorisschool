/**
 * A visible, honest banner for the two database states a visitor can hit.
 *
 * Degrading silently would be worse than a 500: the site would look fine while
 * showing no news and no orders, and nobody would know why.
 */
export function DbNotice({ failure }: { failure: 'not-initialised' | 'unavailable' | null }) {
  if (!failure) return null;

  if (failure === 'not-initialised') {
    return (
      <div role="status" className="border-b border-warning bg-warning/20 px-4 py-3 text-sm sm:px-6">
        <p className="mx-auto max-w-6xl text-[#5c4600]">
          <strong>Deze website is nog niet volledig ingesteld.</strong> De database bevat nog geen
          gegevens. Wie dit beheert: voer{' '}
          <code className="rounded bg-white/60 px-1.5 py-0.5">npm run db:apply</code> uit tegen de
          database van deze omgeving.
        </p>
      </div>
    );
  }

  return (
    <div role="status" className="border-b border-warning bg-warning/20 px-4 py-3 text-sm sm:px-6">
      <p className="mx-auto max-w-6xl text-[#5c4600]">
        Sommige gegevens zijn op dit moment niet beschikbaar. De algemene informatie op deze pagina
        klopt; nieuwsberichten en bestellingen komen terug zodra de verbinding hersteld is.
      </p>
    </div>
  );
}
