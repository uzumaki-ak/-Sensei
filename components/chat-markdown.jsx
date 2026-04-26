"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents = {
  p: ({ ...props }) => <p className="my-1 whitespace-pre-wrap break-words leading-6" {...props} />,
  ul: ({ ...props }) => <ul className="my-2 list-disc space-y-1 pl-4" {...props} />,
  ol: ({ ...props }) => <ol className="my-2 list-decimal space-y-1 pl-4" {...props} />,
  li: ({ ...props }) => <li className="break-words" {...props} />,
  h1: ({ ...props }) => <h1 className="mb-1 mt-2 text-base font-semibold" {...props} />,
  h2: ({ ...props }) => <h2 className="mb-1 mt-2 text-sm font-semibold" {...props} />,
  h3: ({ ...props }) => <h3 className="mb-1 mt-2 text-sm font-semibold" {...props} />,
  a: ({ ...props }) => (
    <a
      className="underline underline-offset-2 hover:text-foreground"
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  ),
  code: ({ inline, ...props }) =>
    inline ? (
      <code className="rounded-sm bg-muted/40 px-1 py-0.5 text-[11px]" {...props} />
    ) : (
      <code className="block whitespace-pre-wrap break-words text-[11px]" {...props} />
    ),
  pre: ({ ...props }) => (
    <pre
      className="my-2 overflow-x-auto rounded-sm border border-border/60 bg-muted/20 p-2 text-[11px]"
      {...props}
    />
  ),
  table: ({ ...props }) => (
    <div className="my-2 w-full overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-[11px]" {...props} />
    </div>
  ),
  thead: ({ ...props }) => <thead className="bg-muted/20" {...props} />,
  tr: ({ ...props }) => <tr className="border-b border-border/50 align-top" {...props} />,
  th: ({ ...props }) => <th className="px-2 py-1 text-left font-semibold" {...props} />,
  td: ({ ...props }) => <td className="px-2 py-1 align-top" {...props} />,
  blockquote: ({ ...props }) => (
    <blockquote className="my-2 border-l-2 border-border/70 pl-3 text-muted-foreground" {...props} />
  ),
};

export default function ChatMarkdown({ content = "", className = "" }) {
  return (
    <div className={`max-w-none text-xs leading-6 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
