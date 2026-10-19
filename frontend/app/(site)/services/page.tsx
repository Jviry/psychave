import { redirect } from 'next/navigation';

/**
 * The services directory now lives on the single public scroll page as
 * /#services (bento cards + per-service guardrails). This route only exists
 * so older links and bookmarks keep resolving.
 */
export default function ServicesRedirect() {
  redirect('/#services');
}
