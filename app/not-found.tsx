import { ButtonLink } from "@/components/ui/Button";
import { Card, Notice, PageTitle, PayShell } from "@/components/ui/Surfaces";

/**
 * A single 404 for the whole application. It says the same thing for a
 * mistyped URL and for a reference that does not exist, so the page cannot be
 * used to work out which references are real.
 */
export default function NotFound() {
  return (
    <PayShell>
      <PageTitle
        title="Page not found"
        description="We could not find the page you were looking for."
      />
      <Card>
        <Notice tone="info" title="Check the link">
          If you followed a link from a receipt or an email, check that it was copied in full.
        </Notice>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/pay" size="lg" className="sm:flex-1">
            Pay COLBIOS dues
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" size="lg" className="sm:flex-1">
            Go to homepage
          </ButtonLink>
        </div>
      </Card>
    </PayShell>
  );
}
