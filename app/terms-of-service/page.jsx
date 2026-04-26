import LegalShell from "@/components/legal-shell";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of service for AI Career Coach.",
};

export default function TermsOfServicePage() {
  return (
    <LegalShell
      title="Terms of Service"
      updatedAt="April 27, 2026"
      intro="These terms govern your use of AI Career Coach. By using the service, you agree to these terms."
    >
      <section>
        <h2 className="mb-2 text-lg font-semibold">1. Use of Service</h2>
        <p className="text-muted-foreground">
          You may use the service only for lawful purposes and in compliance
          with these terms. You are responsible for the content and data you
          submit to the platform.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">2. Accounts</h2>
        <p className="text-muted-foreground">
          You are responsible for keeping account credentials secure and for all
          activity under your account. Notify us immediately if you suspect
          unauthorized use.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">3. Integrations and APIs</h2>
        <p className="text-muted-foreground">
          Features that connect to third-party services (including Google APIs)
          are subject to the policies and terms of those services. You must
          grant only the permissions you are comfortable sharing.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">4. Acceptable Use</h2>
        <p className="text-muted-foreground">
          You may not use the platform for abuse, fraud, unauthorized data
          access, malicious automation, or any activity that violates law or
          third-party platform terms.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">5. Intellectual Property</h2>
        <p className="text-muted-foreground">
          The platform, software, and branding are protected by applicable
          intellectual property laws. You retain ownership of your own uploaded
          content and generated materials, subject to applicable licenses and
          provider terms.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">6. Service Availability</h2>
        <p className="text-muted-foreground">
          We may update, suspend, or discontinue features to maintain security,
          reliability, or compliance. We aim for high availability but do not
          guarantee uninterrupted service.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">7. Limitation of Liability</h2>
        <p className="text-muted-foreground">
          To the fullest extent permitted by law, the service is provided
          &quot;as is&quot; without warranties of any kind. We are not liable for indirect,
          incidental, or consequential damages arising from your use of the
          service.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">8. Contact</h2>
        <p className="text-muted-foreground">
          For legal notices and support:
          {" "}
          <a className="underline underline-offset-4" href="mailto:anikeshuzumaki@gmail.com">
            anikeshuzumaki@gmail.com
          </a>
          {" "}
          (replace before production launch).
        </p>
      </section>
    </LegalShell>
  );
}
