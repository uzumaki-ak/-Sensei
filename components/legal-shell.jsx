import Link from "next/link";

export default function LegalShell({
  title,
  updatedAt,
  intro,
  children,
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-12 md:px-8 md:py-16">
        <header className="mb-8 border-b border-border/60 pb-6">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Policy Document
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {updatedAt}
          </p>
          {intro ? (
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
              {intro}
            </p>
          ) : null}
        </header>

        <article className="space-y-8 text-sm leading-7">{children}</article>

        <footer className="mt-12 border-t border-border/60 pt-5 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <Link className="hover:text-foreground" href="/">
              Home
            </Link>
            <Link className="hover:text-foreground" href="/privacy-policy">
              Privacy Policy
            </Link>
            <Link className="hover:text-foreground" href="/terms-of-service">
              Terms
            </Link>
            <Link className="hover:text-foreground" href="/support">
              Support
            </Link>
            <Link className="hover:text-foreground" href="/data-deletion">
              Data Deletion
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
