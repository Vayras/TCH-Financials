'use client';
import * as React from 'react';
import type { KitContent } from '@/lib/creator-kit';
import { importedDate, metric } from '@/lib/creator-kit';

export function CreatorImage({ src, alt, className = '' }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  // Provider CDN URLs can expire. Keep the saved metrics and permalink useful without recollecting.
  // Provider CDN hosts are dynamic and intentionally allowlisted server-side; next/image would require a mutable remotePatterns list.
  // eslint-disable-next-line @next/next/no-img-element
  return src && !failed ? <img src={src} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <div className={`creator-image-fallback ${className}`}><span>Preview unavailable</span></div>;
}

export default function CreatorKitView({ content, publishedAt }: { content: KitContent; publishedAt?: string }) {
  const { profile, socials, posts } = content;
  return <article className="brand-kit-document">
    <div className="brand-kit-eyebrow">CREATOR MEDIA KIT <span>{publishedAt ? `Published ${importedDate(publishedAt)}` : 'Draft preview'}</span></div>
    <header className="brand-kit-identity"><div><p className="brand-kit-niche">{profile.niche || 'Independent creator'}</p><h1>{profile.display_name || 'Your creator name'}</h1><p className="brand-kit-headline">{profile.headline}</p><p className="brand-kit-meta">{[profile.location,profile.languages].filter(Boolean).join(' · ')}</p></div>{socials[0]?.image_url && <CreatorImage src={socials[0].image_url} alt="Creator profile" className="brand-kit-avatar" />}</header>
    {profile.biography && <section className="brand-kit-section"><h2>About</h2><p className="brand-kit-bio">{profile.biography}</p></section>}
    {!!socials.length && <section className="brand-kit-section"><h2>Social presence</h2><div className="brand-kit-socials">{socials.map(s => <div key={s.username}><a href={s.url ?? undefined} target="_blank" rel="noopener noreferrer">Instagram · @{s.username}</a><div className="brand-kit-number">{metric(s.followers)}</div><p>Followers · {metric(s.posts_count)} posts</p><small>Updated {importedDate(s.imported_at)}</small></div>)}</div></section>}
    {!!posts.length && <section className="brand-kit-section"><h2>Selected work</h2><div className="brand-kit-posts">{posts.map(post => <div className="brand-kit-post" key={`${post.username}:${post.id}`}><CreatorImage src={post.image_url} alt={post.caption.slice(0,100) || 'Selected content'} className="brand-kit-thumbnail" /><div className="brand-kit-post-copy"><small>{post.format} · {importedDate(post.published_at)}</small><p>{post.caption.slice(0,200)}{post.caption.length > 200 ? '…' : ''}</p><small>{[post.likes!=null?`${metric(post.likes)} likes`:null,post.comments!=null?`${metric(post.comments)} comments`:null].filter(Boolean).join(" · ")}</small>{post.url && <a href={post.url} target="_blank" rel="noopener noreferrer">View original ↗</a>}</div></div>)}</div></section>}
    {profile.services && <section className="brand-kit-section"><h2>Work with me</h2><p className="brand-kit-bio">{profile.services}</p></section>}
    {profile.contact_email && <footer className="brand-kit-contact"><span>Let’s create something together.</span><a href={`mailto:${profile.contact_email}`}>{profile.contact_email}</a></footer>}
  </article>;
}
