import type { NavbarLink, LinkPreset } from '@/types/config';

// Retained navigation-to-exhibition logic; no page imports or registers it.
export function getExhibitionEntries(links: (NavbarLink | LinkPreset)[]) {
    return links.filter((link): link is NavbarLink => typeof link !== 'number' &&
        !!link.children?.length && !!link.url && /^\/(?!\/)/.test(link.url) && link.url !== '/')
        .map(link => ({ params: { menu: link.url.replace(/^\/+|\/+$/g, '') }, props: { link } }));
}
