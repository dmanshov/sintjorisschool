import { redirect } from 'next/navigation';

/** The old app's public landing page URL, kept so existing links resolve. */
export default function HomePageRedirect() {
  redirect('/');
}
