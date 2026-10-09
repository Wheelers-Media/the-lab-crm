import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Shown only in the demo build (VITE_IS_DEMO).
export const Welcome = () => (
  <Card>
    <CardHeader className="px-4">
      <CardTitle>Preview mode</CardTitle>
    </CardHeader>
    <CardContent className="px-4">
      <p className="text-sm mb-4">
        This is THE LAB CRM running on sample data. Customer names and companies
        are made up. Job prices are starting prices from the fact sheet.
      </p>
      <p className="text-sm mb-4">
        Click around, drag deals between stages, add notes and tasks. Nothing is
        saved: it resets when you reload.
      </p>
      <p className="text-sm">
        Built on{" "}
        <a
          href="https://github.com/marmelab/atomic-crm"
          className="underline hover:no-underline"
        >
          Atomic CRM
        </a>{" "}
        (open source, MIT licence).
      </p>
    </CardContent>
  </Card>
);
