export const englishCrmMessages = {
  resources: {
    companies: {
      name: "Business |||| Businesses",
      forcedCaseName: "Business",
      fields: {
        name: "Business name",
        website: "Website",
        linkedin_url: "LinkedIn URL",
        phone_number: "Phone number",
        created_at: "Created at",
        nb_contacts: "Number of customers",
        revenue: "Revenue",
        sector: "Sector",
        size: "Size",
        tax_identifier: "Tax Identifier",
        address: "Address",
        city: "City",
        zipcode: "Zip code",
        state_abbr: "State",
        country: "Country",
        description: "Description",
        context_links: "Context links",
        sales_id: "Handled by",
      },
      empty: {
        description: "It seems your business list is empty.",
        title: "No businesses found",
      },
      import: {
        title: "Import businesses",
      },
      field_categories: {
        contact: "Customer",
        additional_info: "Additional information",
        address: "Address",
        context: "Context",
      },
      action: {
        create: "Create Business",
        edit: "Edit business",
        new: "New Business",
        show: "Show business",
      },
      added_on: "Added on %{date}",
      followed_by: "Followed by %{name}",
      followed_by_you: "Followed by you",
      no_contacts: "No customer",
      nb_contacts: "%{smart_count} customer |||| %{smart_count} customers",
      nb_deals: "%{smart_count} job |||| %{smart_count} jobs",
      sizes: {
        one_employee: "1 employee",
        two_to_nine_employees: "2-9 employees",
        ten_to_forty_nine_employees: "10-49 employees",
        fifty_to_two_hundred_forty_nine_employees: "50-249 employees",
        two_hundred_fifty_or_more_employees: "250 or more employees",
      },
      autocomplete: {
        create_error: "An error occurred while creating the business",
        create_item: "Create %{item}",
        create_label: "Start typing to create a new business",
      },
    },
    contacts: {
      name: "Customer |||| Customers",
      forcedCaseName: "Customer",
      field_categories: {
        background_info: "Notes",
        identity: "Customer",
        misc: "Profile",
        personal_info: "How to reach them",
        position: "Business and address",
      },
      fields: {
        first_name: "First name",
        last_name: "Last name",
        last_seen: "Last seen",
        title: "Title",
        company_id: "Business",
        email_jsonb: "Email addresses",
        email: "Email",
        phone_jsonb: "Phone numbers",
        phone_number: "Phone number",
        linkedin_url: "LinkedIn URL",
        background:
          "Notes (what they want, what they drive, anything Eric should know)",
        has_newsletter: "Email newsletter",
        sales_id: "Handled by",
      },
      action: {
        add: "Add customer",
        add_first: "Add your first customer",
        create: "Create customer",
        edit: "Edit customer",
        export_vcard: "Export to vCard",
        new: "New Customer",
        show: "Show customer",
      },
      background: {
        last_activity_on: "Last activity on %{date}",
        added_on: "Added on %{date}",
        followed_by: "Followed by %{name}",
        followed_by_you: "Followed by you",
        status_none: "None",
      },
      position_at: "%{title} at",
      position_at_company: "%{title} at %{company}",
      empty: {
        description: "It seems your customer list is empty.",
        title: "No customers found",
      },
      import: {
        title: "Import customers",
      },
      inputs: {
        genders: {
          male: "He/Him",
          female: "She/Her",
          nonbinary: "They/Them",
        },
        personal_info_types: {
          work: "Work",
          home: "Home",
          other: "Other",
        },
      },
      list: {
        error_loading: "Error loading customers",
      },
      bulk_tag: {
        action: "Tag",
        back: "Back to tags",
        create_description:
          "Create a new tag and apply it to the selected customers.",
        description:
          "Choose an existing tag or create a new one for the selected customers.",
        empty: "No tags yet. Create one to tag the selected customers.",
        error: "Failed to add tag to customers",
        noop: "Selected customers already have this tag",
        success:
          "Tag added to %{smart_count} customer |||| Tag added to %{smart_count} customers",
        title: "Add tag to customers",
      },
      merge: {
        action: "Merge with another customer",
        confirm: "Merge Customers",
        current_contact: "Current Customer (will be deleted)",
        description: "Merge this customer with another one.",
        error: "Failed to merge customers",
        merging: "Merging...",
        no_additional_data: "No additional data to merge",
        select_target: "Please select a customer to merge with",
        success: "Customers merged successfully",
        target_contact: "Target Customer (will be kept)",
        title: "Merge Customer",
        warning_description:
          "All data will be transferred to the second customer. This action cannot be undone.",
        warning_title: "Warning: Destructive Operation",
        what_will_be_merged: "What will be merged:",
      },
      filters: {
        before_last_month: "Before last month",
        before_this_month: "Before this month",
        before_this_week: "Before this week",
        managed_by_me: "Managed by me",
        search: "Search name, truck, VIN, plate",
        this_week: "This week",
        today: "Today",
        tags: "Tags",
        tasks: "Tasks",
      },
      hot: {
        empty_change_status:
          'Change the status of a contact by adding a note to that contact and clicking on "show options".',
        empty_hint: 'Contacts with a "hot" status will appear here.',
        title: "Hot Customers",
      },
    },
    deals: {
      name: "Job |||| Jobs",
      fields: {
        name: "Name",
        description: "Description",
        company_id: "Business",
        contact_ids: "Customers",
        category: "Category",
        amount: "Budget",
        expected_closing_date: "Expected closing date",
        stage: "Stage",
      },
      action: {
        back_to_deal: "Back to job",
        create: "Create job",
        new: "New Job",
      },
      field_categories: {
        misc: "Misc",
      },
      filters: {
        only_mine: "Only jobs I manage",
      },
      archived: {
        action: "Archive",
        error: "Error: job not archived",
        list_title: "Archived Jobs",
        success: "Job archived",
        title: "Archived Job",
        view: "View archived jobs",
      },
      inputs: {
        linked_to: "Linked to",
      },
      unarchived: {
        action: "Send back to the board",
        error: "Error: job not unarchived",
        success: "Job unarchived",
      },
      updated: "Job updated",
      empty: {
        before_create: "before creating a job.",
        description: "It seems your job list is empty.",
        title: "No jobs found",
      },
      import: {
        title: "Import jobs",
      },
      invalid_date: "Invalid date",
    },
    notes: {
      name: "Note |||| Notes",
      forcedCaseName: "Note",
      fields: {
        status: "Status",
        date: "Date",
        attachments: "Attachments",
        contact_id: "Customer",
        deal_id: "Job",
      },
      action: {
        add: "Add note",
        add_first: "Add your first note",
        delete: "Delete note",
        edit: "Edit note",
        update: "Update note",
        add_this: "Add this note",
      },
      sheet: {
        create: "Create note",
        create_for: "Create note for %{name}",
        edit: "Edit note",
        edit_for: "Edit note for %{name}",
      },
      deleted: "Note deleted",
      empty: "No notes yet",
      author_added: "%{name} added a note",
      you_added: "You added a note",
      me: "Me",
      list: {
        error_loading: "Error loading notes",
      },
      note_for_contact: "Note for %{name}",
      stepper: {
        hint: "Go to a customer page and add a note",
      },
      added: "Note added",
      inputs: {
        add_note: "Add a note",
        options_hint: "(attach files, or change details)",
        show_options: "Show options",
      },
      actions: {
        attach_document: "Attach document",
      },
      validation: {
        note_or_attachment_required: "A note or an attachment is required",
      },
    },
    orders: {
      name: "Order |||| Orders",
      fields: {
        ordered_at: "Date",
        order_number: "Order",
        contact_id: "Customer",
        line_items: "What they bought",
        total: "Total",
        financial_status: "Payment",
      },
      filters: {
        deposits: "Deposits only",
        no_contact: "Not linked to a customer",
      },
      purchases: "Purchases",
      lifetime: "%{smart_count} order |||| %{smart_count} orders",
      see_all: "See all %{smart_count} orders",
      empty_contact: "No Shopify orders yet.",
      deposit: "Deposit",
      cancelled: "Cancelled",
    },
    shopify_checkouts: {
      name: "Abandoned cart |||| Abandoned carts",
      fields: {
        checkout_updated_at: "Last activity",
        customer: "Customer",
        line_items: "In the cart",
        total: "Total",
        follow_up: "Follow-up",
      },
      filters: {
        big: "$2,000 and up",
      },
      action: {
        open_cart: "Open cart",
      },
      call_task: "Call task added",
    },
    appointments: {
      name: "Appointment |||| Appointments",
      fields: {
        start_at: "When",
        title: "Service",
        contact_id: "Customer",
        vehicle: "Vehicle",
        resource: "With",
        deposit_paid: "Deposit",
        status: "Status",
      },
      filters: {
        upcoming: "Upcoming",
        deposit_unpaid: "Deposit unpaid",
      },
      resources: {
        "detailing-bay": "Detailing bay",
        eric: "Eric",
      },
      deposit: {
        paid: "Paid",
        unpaid: "Not paid",
      },
      statuses: {
        booked: "Booked",
        rescheduled: "Rescheduled",
        cancelled: "Cancelled",
        completed: "Completed",
        no_show: "No-show",
      },
    },
    sales: {
      name: "User |||| Users",
      fields: {
        first_name: "First name",
        last_name: "Last name",
        email: "Email",
        secondary_email: "Secondary email",
        secondary_emails: "Secondary emails",
        administrator: "Admin",
        disabled: "Disabled",
      },
      create: {
        error: "An error occurred while creating the user.",
        success:
          "User created. They will soon receive an email to set their password.",
        title: "Create a new user",
      },
      edit: {
        error: "An error occurred. Please try again.",
        record_not_found: "Record not found",
        success: "User updated successfully",
        title: "Edit %{name}",
      },
      action: {
        new: "New user",
      },
    },
    tasks: {
      name: "Task |||| Tasks",
      forcedCaseName: "Task",
      fields: {
        text: "Description",
        due_date: "Due date",
        type: "Type",
        contact_id: "Customer",
        due_short: "due",
      },
      action: {
        add: "Add task",
        create: "Create task",
        edit: "Edit task",
      },
      actions: {
        postpone_next_week: "Postpone to next week",
        postpone_tomorrow: "Postpone to tomorrow",
        title: "task actions",
      },
      added: "Task added",
      deleted: "Task deleted successfully",
      dialog: {
        create: "Create task",
        create_for: "Create task for %{name}",
      },
      sheet: {
        edit: "Edit task",
        edit_for: "Edit task for %{name}",
      },
      empty: "No tasks yet",
      empty_list_hint: "Tasks added to your customers will appear here.",
      filters: {
        later: "Later",
        overdue: "Overdue",
        this_week: "This week",
        today: "Today",
        tomorrow: "Tomorrow",
        with_pending: "With pending tasks",
      },
      regarding_contact: "(Re: %{name})",
      updated: "Task updated",
    },
    tags: {
      name: "Tag |||| Tags",
      action: {
        add: "Add tag",
        create: "Create new tag",
      },
      dialog: {
        color: "Color",
        create_title: "Create a new tag",
        edit_title: "Edit tag",
        name_label: "Tag name",
        name_placeholder: "Enter tag name",
      },
      empty: "No tags yet.",
    },
  },
  crm: {
    action: {
      reset_password: "Reset Password",
    },
    auth: {
      first_name: "First name",
      last_name: "Last name",
      confirm_password: "Confirm password",
      confirmation_required:
        "Please follow the link we just sent you by email to confirm your account.",
      recovery_email_sent:
        "If you're a registered user, you should receive a password recovery email shortly.",
      sign_in_failed: "Failed to log in.",
      sign_in_google_workspace: "Sign in with Google Workplace",
      signup: {
        create_account: "Create account",
        create_first_user:
          "Create the first user account to complete the setup.",
        creating: "Creating...",
        initial_user_created: "Initial user successfully created",
      },
      welcome_title: "Welcome to THE LAB CRM",
    },
    common: {
      account_manager: "Handled by",
      activity: "Activity",
      added: "added",
      details: "Details",
      last_activity_with_date: "last activity %{date}",
      load_more: "Load more",
      misc: "Misc",
      past: "Past",
      read_more: "Read more",
      retry: "Retry",
      show_less: "Show less",
      copied: "Copied!",
      copy: "Copy",
      loading: "Loading...",
      me: "Me",
      task_count: "%{smart_count} task |||| %{smart_count} tasks",
    },
    changelog: {
      title: "Changelog",
    },
    activity: {
      added_company: "%{name} added business",
      you_added_company: "You added business",
      added_contact: "%{name} added",
      you_added_contact: "You added",
      added_note: "%{name} added a note about",
      you_added_note: "You added a note about",
      added_note_about_deal: "%{name} added a note about job",
      you_added_note_about_deal: "You added a note about job",
      added_deal: "%{name} added job",
      you_added_deal: "You added job",
      at_company: "at",
      to: "to",
      load_more: "Load more activity",
    },
    dashboard: {
      deals_chart: "Upcoming Job Revenue",
      deals_pipeline: "Jobs Pipeline",
      latest_activity: "Latest Activity",
      latest_activity_error: "Error loading latest activity",
      latest_notes: "My Latest Notes",
      latest_notes_added_ago: "added %{timeAgo}",
      stepper: {
        install: "Install THE LAB CRM",
        progress: "%{step}/3 done",
        whats_next: "What's next?",
      },
      upcoming_tasks: "Upcoming Tasks",
    },
    data_import: {
      button: "Import CSV",
      complete:
        "Import complete. Imported %{importCount} records, with %{errorCount} errors",
      csv_file: "CSV File",
      error:
        "Failed to import this file, please make sure you provided a valid CSV file.",
      in_progress: "Import in progress…",
      progress:
        "Imported %{importCount} / %{rowCount} records, with %{errorCount} errors.",
      remaining_time: "Estimated remaining time:",
      resource: "Resource",
      sample_download: "Download CSV sample",
      sample_hint: "Here is a sample CSV file you can use as a template",
      start: "Start import",
      stop: "Stop import",
      stopped:
        "Import stopped. Imported %{importCount} records, with %{errorCount} errors",
      title: "Import data",
    },
    header: {
      import_data: "Import from JSON",
    },
    image_editor: {
      change: "Change",
      drop_hint: "Drop a file to upload, or click to select it.",
      editable_content: "Editable content",
      title: "Upload and resize image",
      update_image: "Update Image",
    },
    import: {
      action: {
        download_error_report: "Download the error report",
        import: "Import",
        import_another: "Import another file",
      },
      error: {
        unable: "Unable to import this file.",
      },
      idle: {
        description_1:
          "You can import sales, businesses, customers, notes, and tasks.",
        description_2:
          "Data must be in a JSON file matching the following sample:",
      },
      status: {
        all_success: "All records were imported successfully.",
        complete: "Import complete.",
        failed: "Failed",
        imported: "Imported",
        in_progress:
          "Import in progress, please don't navigate away from this page.",
        some_failed: "Some records were not imported.",
        table_caption: "Import status",
      },
      title: "Import from JSON",
    },
    settings: {
      about: "About",
      companies: {
        sectors: "Sectors",
      },
      dark_mode_logo: "Dark Mode Logo",
      deals: {
        categories: "Categories",
        currency: "Currency",
        pipeline_help: "Select which job stages should count as pipeline jobs.",
        pipeline_statuses: "Pipeline Statuses",
        stages: "Stages",
      },
      light_mode_logo: "Light Mode Logo",
      notes: {
        statuses: "Statuses",
      },
      reset_defaults: "Reset to Defaults",
      save_error: "Failed to save configuration",
      saved: "Configuration saved successfully",
      saving: "Saving...",
      tasks: {
        types: "Types",
      },
      preferences: "Preferences",
      title: "Settings",
      app_title: "App Title",
      sections: {
        branding: "Branding",
      },
      validation: {
        duplicate: "Duplicate %{display_name}: %{items}",
        in_use:
          "Cannot remove %{display_name} that are still used by jobs: %{items}",
        validating: "Validating\u2026",
        entities: {
          categories: "categories",
          stages: "stages",
        },
      },
    },
    theme: {
      dark: "Dark",
      label: "Theme",
      light: "Light",
      system: "System",
    },
    language: "Language",
    navigation: {
      label: "CRM navigation",
    },
    profile: {
      add_secondary_email: "Add an email",
      email_taken: "%{email} is already used by another user",
      no_secondary_emails: "None",
      secondary_email_invalid: "%{email} is not a valid email address",
      secondary_email_is_primary: "%{email} is already your main address",
      secondary_email_taken: "%{email} is already used by another user",
      too_many_secondary_emails:
        "You cannot add more than 10 secondary email addresses",
      secondary_emails_help:
        "Other addresses you send emails from. Leave one empty to remove it.",
      inbound: {
        description:
          "You can start sending emails to your server's inbound email address, e.g. by adding it to the %{field} field. THE LAB CRM will process the emails and add notes to the corresponding customers.",
        title: "Inbound email",
      },
      mcp: {
        title: "MCP Server",
        description:
          "Use this URL to connect your AI assistant to your CRM data via the Model Context Protocol (MCP).",
      },
      password: {
        change: "Change password",
      },
      password_reset_sent:
        "A reset password email has been sent to your email address",
      record_not_found: "Record not found",
      title: "Profile",
      updated: "Your profile has been updated",
      update_error: "An error occurred. Please try again",
    },
    validation: {
      invalid_url: "Must be a valid URL",
      invalid_linkedin_url: "URL must be from linkedin.com",
    },
  },
} as const;

type MessageSchema<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? MessageSchema<T[K]>
      : never;
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

export type CrmMessages = MessageSchema<typeof englishCrmMessages>;
export type PartialCrmMessages = DeepPartial<CrmMessages>;
