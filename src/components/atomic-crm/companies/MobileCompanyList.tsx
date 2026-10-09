import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";

import { MobileListPage, MobileSearch } from "../layout/MobileListPage";
import type { Company } from "../types";

const CompanyCard = ({ company }: { company: Company }) => (
  <Card className="p-0">
    <Link
      to={`/companies/${company.id}/show`}
      className="flex items-center gap-3 p-3"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{company.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[
            company.city,
            company.nb_contacts
              ? `${company.nb_contacts} customer${company.nb_contacts === 1 ? "" : "s"}`
              : null,
            company.phone_number,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  </Card>
);

/** Businesses and fleets on the phone. */
export const MobileCompanyList = () => (
  <MobileListPage<Company>
    resource="companies"
    title="Businesses"
    sort={{ field: "name", order: "ASC" }}
    empty="No businesses yet."
    toolbar={<MobileSearch placeholder="Search businesses" />}
    renderItem={(company) => <CompanyCard company={company} />}
  />
);
