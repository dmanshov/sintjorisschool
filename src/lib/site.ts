/**
 * Facts about the school that were hard-coded in the FlutterFlow widget tree.
 * They live here rather than in the database because they change roughly never,
 * and a typo in a phone number should show up in a diff.
 */
export const school = {
  name: 'Sint-Jorisschool',
  tagline: 'Kleuter- en basisschool Tielt-Winge',
  description:
    'Ontdek onze visie, laat je verrassen door onze manier van werken of kom eens piepen in onze online schoolkrant. Wil je ons eens in het écht ontmoeten? Kom gerust eens langs voor een persoonlijke babbel of een rondleiding. Heel graag tot binnenkort!',
  address: { street: 'Tiensesteenweg 4', postalCode: '3390', city: 'Tielt-Winge' },
  phone: { display: '016/64.06.97', tel: '+3216640697' },
  email: { general: 'info@sintjorisschool.be', directie: 'directie@sintjorisschool.be', ouderraad: 'ouderraad@sintjorisschool.be' },
  coordinates: { lat: 50.90721, lng: 4.876487 },
  links: {
    maps: 'https://goo.gl/maps/byG5bbbiZSbhZdr4A',
    waze: 'https://waze.com/ul?ll=50.90721,4.876487&navigate=yes',
    facebook: 'https://www.facebook.com/people/Sintjorisschool-SJW/100046396941771/',
    trooper: 'https://www.trooper.be/nl/trooperverenigingen/sintjorisschool',
    aanmelden: 'https://tielt-wingebao.aanmelden.vlaanderen/',
    builtBy: 'http://www.adappteez.be',
    calendarEmbed:
      'https://calendar.google.com/calendar/embed?src=sintjorisschool.be_p0puh9d7ns6neo6fcf69avisbg%40group.calendar.google.com&ctz=Europe%2FBrussels',
    calendarIcs:
      'https://calendar.google.com/calendar/ical/sintjorisschool.be_p0puh9d7ns6neo6fcf69avisbg%40group.calendar.google.com/public/basic.ics',
    luizen: 'https://www.klasse.be/3517/luizen-uitroeien-in-8-stappen/',
    clb: 'https://www.vrijclb.be/vrij-clb-brabant-oost-1',
    klokkenluiders:
      'https://onderwijs.vlaanderen.be/nl/onderwijspersoneel/van-basis-tot-volwassenenonderwijs/je-werkomgeving/welzijn-veiligheid-en-gezondheid/klokkenluidersregeling-in-onderwijs',
  },
} as const;

export const documents = {
  infobrochure: '/pdfs/Infobrochure_2026-2027.pdf',
  doorlichtingsverslag: '/pdfs/Doorlichtingsverslag_2023.pdf',
  privacyverklaring: '/pdfs/Privacyverklaring-Sint-Jorisschool.pdf',
  attestMedicijnen: '/pdfs/Attest_Medicijnen.pdf',
  geneeskundigGetuigschrift: '/pdfs/Geneeskundig_Getuigschrift.pdf',
} as const;

/** Primary navigation, in the order the old header showed it. */
export const mainNav = [
  { label: 'Welkom', href: '/' },
  { label: 'Onze school', href: '/onzeSchool' },
  { label: 'Praktisch', href: '/praktisch' },
  { label: 'Kalender', href: '/kalender' },
  { label: 'Schoolkrant', href: '/schoolkrant' },
  { label: 'Contact', href: '/contact' },
] as const;

/** Teacher mailboxes, as listed in the profile page of the old app. */
export const teacherContacts = {
  kleuterschool: {
    title: 'Kleuterschool',
    intro:
      'Heb je een vraag voor een specifieke leerkracht? Hier vind je een overzicht van alle email adressen van de kleuterschool.',
    groups: [
      {
        label: 'Leerkrachten',
        people: [
          { name: 'Isabelle Lambeens', email: 'isabelle.lambeens@sintjorisschool.be' },
          { name: 'Annick Schots', email: 'annick.schots@sintjorisschool.be' },
          { name: 'Jori Van Geertruyden', email: 'jori.vangeertruyden@sintjorisschool.be' },
          { name: 'Carine Van der Weyden', email: 'carine.vanderweyden@sintjorisschool.be' },
          { name: 'Tommy Heusdens', email: 'tommy.heusdens@sintjorisschool.be' },
        ],
      },
      {
        label: 'Ambulante ondersteuning',
        people: [
          { name: 'Lien Vandegaer', email: 'lien.vandegaer@sintjorisschool.be' },
          { name: 'Eva Wyndaele', email: 'eva.wyndaele@sintjorisschool.be' },
          { name: 'Dolores Lauwereins', email: 'dolores.lauwereins@sintjorisschool.be' },
        ],
      },
      {
        label: 'Kinderverzorgster',
        people: [{ name: 'Pem Van den Wijngaert', email: 'pem.vandenwijngaert@sintjorisschool.be' }],
      },
    ],
  },
  lagereSchool: {
    title: 'Lagere school',
    intro:
      'Heb je een vraag voor een specifieke leerkracht? Hier vind je een overzicht van alle email adressen van de lagere school.',
    groups: [
      {
        label: 'Leerkrachten',
        people: [
          { name: 'Ine Vervloesem', email: 'ine.vervloesem@sintjorisschool.be' },
          { name: 'Chris Alaerts', email: 'chris.alaerts@sintjorisschool.be' },
          { name: 'Sara Van de Gaer', email: 'sara.vandegaer@sintjorisschool.be' },
          { name: 'Caroline Vancauwenbergh', email: 'caroline.vancauwenbergh@sintjorisschool.be' },
          { name: 'Tisha Naulaerts', email: 'tisha.naulaerts@sintjorisschool.be' },
          { name: 'Julie Wuestenberg', email: 'julie.wuestenberg@sintjorisschool.be' },
          { name: 'Jonas Verstraeten', email: 'jonas.verstraeten@sintjorisschool.be' },
          // The old app listed this as leslie.crabbé@… with an accented é in the
          // local part. Most mail servers reject that. Worth confirming with the
          // school which spelling actually receives mail.
          { name: 'Leslie Crabbé', email: 'leslie.crabbe@sintjorisschool.be' },
          { name: 'Jonas Loeckx', email: 'jonas.loeckx@sintjorisschool.be' },
          { name: 'Maxim Wijnants', email: 'maxim.wijnants@sintjorisschool.be' },
        ],
      },
      {
        label: 'Ambulante ondersteuning',
        people: [
          { name: 'Hannah Goossens', email: 'hannah.goossens@sintjorisschool.be' },
          { name: 'Eva Wyndaele', email: 'eva.wyndaele@sintjorisschool.be' },
        ],
      },
      {
        label: 'Zorgcoördinator',
        people: [{ name: 'Leen Meykens', email: 'leen.meykens@sintjorisschool.be' }],
      },
    ],
  },
} as const;

/** Internal whistleblower contact, shown on /meldpunt. */
export const meldpunt = {
  organisation: 'Katholiek Onderwijs Vlaanderen',
  address: 'Guimardstraat 1, 1040 Brussel',
  phone: { display: '02/507.07.12', tel: '+3225070712' },
  email: 'klokkenluider@katholiekonderwijs.vlaanderen',
} as const;

/** CLB, shown on /onzeSchool under Partners. Editable parts come from the CMS. */
export const clb = {
  vestiging:
    'Vrij CLB Brabant Oost\nVestiging Diest-Tessenderlo\nMariëndaalstraat 35, 3290 Diest\nTel: 013/31.27.29\ninfobasis-diest@vrijclbbrabantoost.be',
} as const;
