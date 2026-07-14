import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPost } from "@/modules/cms/services/content.service";
import { logger } from "@/lib/logger";
import { Reveal } from "@/components/ui/reveal";

export const revalidate = 3600;

function formatDate(date: Date | null) {
  return new Date(date ?? Date.now()).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await getPublishedPost(slug);
    if (post) {
      return {
        title: post.title,
        description: post.excerpt || undefined,
        openGraph: post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : undefined
      };
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to load blog post metadata");
  }
  return { title: "Journal" };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let post = null;
  try {
    post = await getPublishedPost(slug);
  } catch (error) {
    logger.error({ err: error }, "Failed to load blog post");
  }
  if (!post) notFound();

  return (
    <div className="pb-8">
      <article className="frame mx-auto max-w-3xl pt-16">
        <Reveal>
          <Link
            href="/blog"
            className="technical mb-8 inline-block !text-ink-faint transition-colors hover:!text-gold"
          >
            ← Back to Journal
          </Link>
          <p className="technical mb-4 !text-ink-faint">{formatDate(post.publishedAt)}</p>
          <h1 className="text-3xl font-light leading-tight tracking-tight text-ink md:text-4xl">{post.title}</h1>
          {post.excerpt ? (
            <p className="mt-4 text-lg font-light leading-relaxed text-ink-mute">{post.excerpt}</p>
          ) : null}
        </Reveal>

        {post.coverImageUrl ? (
          <Reveal delay={0.05}>
            <div className="relative mt-10 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-ink/10 bg-ivory">
              <Image
                src={post.coverImageUrl}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          </Reveal>
        ) : null}

        <Reveal delay={0.08}>
          <div className="mt-10 space-y-5 text-base leading-relaxed text-ink-soft">
            {post.body
              .split(/\n{2,}/)
              .map((para, i) =>
                para.trim() ? (
                  <p key={i} className="whitespace-pre-wrap">
                    {para.trim()}
                  </p>
                ) : null
              )}
          </div>
        </Reveal>
      </article>
    </div>
  );
}
