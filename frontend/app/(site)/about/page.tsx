import { redirect } from 'next/navigation';

/**
 * About content (Vision / Clinic / Mission + anonymized roster) now lives on
 * the single public scroll page as /#about. This route only exists so older
 * links and bookmarks keep resolving.
 */
export default function AboutRedirect() {
  redirect('/#about');
}
