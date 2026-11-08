import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { SocialMediaLink } from '../lib/types';

export function SocialLinksList({
  links,
  emptyMessage = 'No social media links provided.',
}: {
  links?: SocialMediaLink[];
  emptyMessage?: string;
}) {
  if (!links || links.length === 0) {
    return <p className="text-xs text-pine/70">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {links.map((link, index) => (
        <li key={`${link.platform}-${index}`}>
          <a
            href={link.url}
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
