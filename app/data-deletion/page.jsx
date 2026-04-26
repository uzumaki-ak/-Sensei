import LegalShell from "@/components/legal-shell";

export const metadata = {
  title: "Data Deletion",
  description: "How to request account and integration data deletion.",
};

export default function DataDeletionPage() {
  return (
    <LegalShell
      title="Data Deletion"
      updatedAt="April 27, 2026"
      intro="This page explains how to remove your account data and revoke Google access."
    >
      <section>
        <h2 className="mb-2 text-lg font-semibold">1. In-App Deletion</h2>
        <p className="text-muted-foreground">
          You can remove specific records directly in product modules where
          delete actions are available (for example, pipeline items or
          generated-history entries).
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">2. Full Account Deletion Request</h2>
        <p className="text-muted-foreground">
          Email your deletion request to
          {" "}
          <a className="underline underline-offset-4" href="mailto:anikeshuzumaki@gmail.com">
            anikeshuzumaki@gmail.com
          </a>
          {" "}
          from the account email you used to register. Include the subject:
          &quot;Account Deletion Request&quot;.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">3. Google Access Revocation</h2>
        <p className="text-muted-foreground">
          You can disconnect Google from the app settings and revoke access in
          your Google account permissions dashboard. Revocation prevents future
          API access from this app.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">4. Processing Timeline</h2>
        <p className="text-muted-foreground">
          Verified deletion requests are typically processed within 7 business
          days, subject to legal retention obligations and security review.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">5. Data Retention Exceptions</h2>
        <p className="text-muted-foreground">
          Some records may be retained for fraud prevention, dispute handling,
          or legal compliance where required by law.
        </p>
      </section>
    </LegalShell>
  );
}
