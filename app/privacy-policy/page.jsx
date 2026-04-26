import LegalShell from "@/components/legal-shell";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for AI Career Coach.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updatedAt="April 27, 2026"
      intro="This policy explains how AI Career Coach collects, uses, stores, and deletes personal data, including Google user data when Gmail integration is enabled."
    >
      <section>
        <h2 className="mb-2 text-lg font-semibold">1. Data We Collect</h2>
        <p className="text-muted-foreground">
          We collect account profile details, job/application records, resume
          content, interview transcripts, and tool outputs that you generate in
          the product. If you connect Google, we collect only the Gmail data
          required for the features you explicitly use.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">2. How We Use Data</h2>
        <p className="text-muted-foreground">
          We use your data to run core product features such as interview prep,
          outreach generation, analytics, and personalized recommendations. We
          do not sell your personal data. We request the minimum Google OAuth
          scopes necessary for enabled functionality.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">3. Google User Data</h2>
        <p className="text-muted-foreground">
          Google user data is used only to provide user-facing features that are
          visible in the app (for example, creating or managing draft outreach
          emails if you grant Gmail permissions). Google data handling follows
          the Google API Services User Data Policy and Limited Use requirements.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">4. Sharing and Disclosure</h2>
        <p className="text-muted-foreground">
          We do not transfer or sell personal data for advertising or data
          brokerage. We may share data with infrastructure providers strictly to
          operate the service, under confidentiality and security controls.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">5. Storage and Security</h2>
        <p className="text-muted-foreground">
          Data is protected in transit and at rest using industry-standard
          safeguards. Access is restricted to authorized systems and personnel
          for operations, support, and security response.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">6. Retention</h2>
        <p className="text-muted-foreground">
          We retain data only as long as needed for product functionality,
          troubleshooting, compliance, and account continuity. You can request
          deletion, and some records can be purged directly in-product.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">7. Your Rights</h2>
        <p className="text-muted-foreground">
          You can request data export or deletion. For deletion workflow details,
          visit the Data Deletion page. You may also disconnect Google access
          at any time from your account settings and Google account permissions.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">8. Contact</h2>
        <p className="text-muted-foreground">
          For privacy or security requests, contact:
          {" "}
          <a className="underline underline-offset-4" href="mailto:anikeshuzumaki@gmail.com">
            anikeshuzumaki@gmail.com
          </a>
          {" "}
          (replace with your production support email before launch).
        </p>
      </section>
    </LegalShell>
  );
}
