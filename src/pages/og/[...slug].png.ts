import { getCollection, type CollectionEntry } from 'astro:content';
import type { APIContext, GetStaticPaths } from 'astro';
import { defaultFavicons } from '@constants/icon';
import { profileConfig, siteConfig } from '@/config';
import { renderOgImage } from '@utils/og-render';
export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
    if (!siteConfig.generateOgImages) return [];
    const posts = await getCollection('posts', ({data}) => !data.draft);
    return [
        { params: { slug: '_site' }, props: {} },
        ...posts.map(post => ({params: {slug: post.id}, props: {post}})),
    ];
};

export async function GET({props}: APIContext<{post?: CollectionEntry<'posts'>}>) {
    const post = props.post;
    const png = await renderOgImage(post ? {
        title: post.data.title,
        description: post.data.description,
        author: post.data.author,
        published: post.data.published,
    } : {title: siteConfig.title, description: siteConfig.subtitle}, {
        siteTitle: siteConfig.title,
        siteURL: siteConfig.siteURL,
        author: profileConfig.name,
        hue: Number(siteConfig.themeColor.hue),
        avatar: profileConfig.avatar,
        icon: (siteConfig.favicon[0] || defaultFavicons[0])?.src,
    });
    return new Response(new Uint8Array(png), {headers: {
        'Content-Type':'image/png',
        'Cache-Control':'public, max-age=3600',
    }});
}
