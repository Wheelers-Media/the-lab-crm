import { useState } from "react";
import { useRecordContext, useTranslate, WithRecord } from "ra-core";
import { ArrayField } from "@/components/admin/array-field";
import { SingleFieldList } from "@/components/admin/single-field-list";
import { TextField } from "@/components/admin/text-field";
import { EmailField } from "@/components/admin/email-field";
import { BadgeCheck, Check, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { translatePersonalInfoTypeLabel } from "./contactModel";
import {
  customerPlace,
  leadSourceName,
  membershipName,
  preferredContactName,
} from "./customerProfile";
import type { Contact } from "../types";

export const ContactPersonalInfo = () => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();

  if (!record) return null;
  const place = customerPlace(record);

  return (
    <div>
      <ArrayField source="email_jsonb">
        <SingleFieldList className="flex-col gap-y-0">
          <EmailRow />
        </SingleFieldList>
      </ArrayField>

      {record.has_newsletter && (
        <p className="pl-6 py-1 text-sm text-muted-foreground">
          {translate("resources.contacts.fields.has_newsletter")}
        </p>
      )}

      <ArrayField source="phone_jsonb">
        <SingleFieldList className="flex-col gap-y-0">
          <PersonalInfoRow
            icon={<Phone className="w-4 h-4 text-muted-foreground" />}
            primary={<TextField source="number" />}
            showType
          />
        </SingleFieldList>
      </ArrayField>
      {place ? (
        <PersonalInfoRow
          icon={<MapPin className="w-4 h-4 text-muted-foreground" />}
          primary={<span>{place}</span>}
        />
      ) : null}
      <div className="flex flex-wrap gap-1 pt-2">
        {record.preferred_contact ? (
          <span className="lab-chip lab-chip-muted">
            Prefers{" "}
            {preferredContactName(record.preferred_contact).toLowerCase()}
          </span>
        ) : null}
        <span
          className={`lab-chip ${record.sms_consent ? "lab-chip-bay" : "lab-chip-muted"}`}
          title={
            record.sms_consent_at
              ? `Agreed ${new Date(record.sms_consent_at).toLocaleDateString("en-CA")}`
              : undefined
          }
        >
          {record.sms_consent ? "OK to text" : "No texts"}
        </span>
        {record.membership ? (
          <span className="lab-chip lab-chip-boutique">
            <BadgeCheck className="w-3 h-3" />
            {membershipName(record.membership)}
          </span>
        ) : null}
        {record.lead_source ? (
          <span className="lab-chip lab-chip-muted">
            From {leadSourceName(record.lead_source)}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const EmailRow = () => {
  const record = useRecordContext<{ email: string }>();
  const translate = useTranslate();
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(record.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <PersonalInfoRow
      icon={
        <button
          type="button"
          onClick={handleCopy}
          title={translate("crm.common.copy")}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
        </button>
      }
      primary={<EmailField source="email" />}
    />
  );
};

const PersonalInfoRow = ({
  icon,
  primary,
  showType,
}: {
  icon: ReactNode;
  primary: ReactNode;
  showType?: boolean;
}) => {
  const translate = useTranslate();

  return (
    <div className="flex flex-row items-center gap-x-2 py-1 min-h-6">
      {icon}
      <div className="flex flex-wrap gap-x-2 gap-y-0 text-sm">
        {primary}
        {showType ? (
          <WithRecord
            render={(row) =>
              row.type !== "Other" && (
                <span className="text-muted-foreground">
                  {translatePersonalInfoTypeLabel(row.type, translate)}
                </span>
              )
            }
          />
        ) : null}
      </div>
    </div>
  );
};
