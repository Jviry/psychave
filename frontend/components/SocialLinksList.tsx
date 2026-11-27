import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { SocialMediaLink } from '../lib/types';

function safeHttpUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function SocialLinksList({
  links,
  emptyMessage = 'No social media links provided.',
}: {
  links?: SocialMediaLink[];
  emptyMessage?: string;
}) {
  const safeLinks = (links ?? [])
    .map((link) => ({ ...link, safeUrl: safeHttpUrl(link.url) }))
    .filter((link): link is SocialMediaLink & { safeUrl: string } => Boolean(link.safeUrl));

  if (safeLinks.length === 0) {
    return <p className="text-xs text-pine/70">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {safeLinks.map((link, index) => (
        <li key={`${link.platform}-${index}`}>
          <a
            href={link.safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1.5 text-xs text-accent-ink hover:text-pine hover:underline break-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            <span className="font-semibold shrink-0">{link.platform}:</span>
            <span className="font-mono">{link.url}</span>
            <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
