import { redirect } from 'next/navigation';

/** The old app's signed-in landing page. One landing page now serves both. */
export default function HomeRedirect() {
  redirect('/');
}
