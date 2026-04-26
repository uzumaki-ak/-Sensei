import LegalShell from "@/components/legal-shell";

export const metadata = {
  title: "Support",
  description: "Support and compliance contact details for AI Career Coach.",
};

export default function SupportPage() {
  return (
    <LegalShell
      title="Support"
      updatedAt="April 27, 2026"
      intro="For product help, OAuth verification clarifications, and compliance requests, use the contact details below."
    >
      <section>
        <h2 className="mb-2 text-lg font-semibold">Support Contact</h2>
        <p className="text-muted-foreground">
          Email:
          {" "}
          <a className="underline underline-offset-4" href="mailto:anikeshuzumaki@gmail.com">
            anikeshuzumaki@gmail.com
          </a>
          {" "}
          (replace with your real support mailbox before production).
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">OAuth Verification Contact</h2>
        <p className="text-muted-foreground">
          Use the same monitored email in Google Cloud OAuth consent screen as
          both User support email and Developer contact email to avoid missing
          Trust &amp; Safety follow-ups.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">What to Include in Requests</h2>
        <p className="text-muted-foreground">
          Include your account email, affected feature, timestamps, and
          screenshots/log excerpts when reporting integration issues. This helps
          us resolve OAuth and API issues faster.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Policy Links</h2>
        <p className="text-muted-foreground">
          Privacy Policy: /privacy-policy
          <br />
          Terms of Service: /terms-of-service
          <br />
          Data Deletion: /data-deletion
        </p>
      </section>
    </LegalShell>
  );
}
