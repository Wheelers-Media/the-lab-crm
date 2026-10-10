// One-off login check (runs in GitHub Actions on admin/* branches).
// Prints settings and account states only: no emails, tokens or secrets,
// because this repository is public.
const ref = process.env.SUPABASE_PROJECT_ID;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const api = async (path, init = {}) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};
const sql = (query) => api("/database/query", { method: "POST", body: JSON.stringify({ query }) });
const out = [];
const log = (s) => out.push(s);

const cfg = await api("/config/auth");
log(`site_url: ${cfg.site_url}`);
log(`uri_allow_list: ${cfg.uri_allow_list}`);
log(`mailer_otp_exp: ${cfg.mailer_otp_exp}`);
log(`custom smtp: ${cfg.smtp_host ? "yes" : "no"}`);
log(`email rate limit per hour: ${cfg.rate_limit_email_sent}`);
const tpl = cfg.mailer_templates_recovery_content ?? "";
log(`recovery template: ${tpl ? tpl.replace(/\s+/g, " ").slice(0, 300) : "(default)"}`);
const inv = cfg.mailer_templates_invite_content ?? "";
log(`invite template: ${inv ? inv.replace(/\s+/g, " ").slice(0, 300) : "(default)"}`);

const users = await sql(`
  select s.id, s.first_name, s.disabled, s.administrator,
         split_part(u.email, '@', 2) as email_domain,
         u.created_at, u.invited_at, u.email_confirmed_at, u.recovery_sent_at,
         u.last_sign_in_at, u.banned_until, (u.encrypted_password is not null and u.encrypted_password <> '') as has_password
  from public.sales s join auth.users u on u.id = s.user_id order by s.id`);
log("users:");
for (const u of users) log("  " + JSON.stringify(u));

const eric = await sql(`
  select s.id, u.updated_at, u.last_sign_in_at, u.email_confirmed_at, u.banned_until,
         u.recovery_sent_at, u.email_change, u.phone, u.is_sso_user, u.deleted_at,
         (select count(*) from auth.identities i where i.user_id = u.id) as identities,
         (select string_agg(i.provider, ',') from auth.identities i where i.user_id = u.id) as providers,
         lower(u.email) = lower(s.email) as sales_email_matches_login
  from public.sales s join auth.users u on u.id = s.user_id where s.first_name = 'Eric'`);
log("eric login: " + JSON.stringify(eric));

const fnLogs = await api(`/analytics/endpoints/logs.all?sql=${encodeURIComponent(
  "select timestamp, m.function_id, r.method, resp.status_code from function_edge_logs cross join unnest(metadata) as m cross join unnest(m.request) as r cross join unnest(m.response) as resp where r.url like '%/users%' order by timestamp desc limit 15",
)}`).catch((e) => ({ error: String(e).slice(0, 200) }));
log("users function calls: " + JSON.stringify(fnLogs?.result ?? fnLogs).slice(0, 1500));

const authLogs = await api(`/analytics/endpoints/logs.all?sql=${encodeURIComponent(
  "select timestamp, event_message from auth_logs order by timestamp desc limit 25",
)}`).catch((e) => ({ error: String(e).slice(0, 200) }));
const rows = authLogs?.result ?? [];
log("auth log:");
for (const r of rows) {
  let msg = r.event_message ?? "";
  try {
    const j = JSON.parse(msg);
    msg = [j.level, j.msg, j.error, j.path, j.status, j.action].filter(Boolean).join(" | ");
  } catch {}
  log(`  ${r.timestamp} ${String(msg).replace(/\S+@\S+/g, "[email]").slice(0, 200)}`);
}
if (!rows.length) log("  " + JSON.stringify(authLogs).slice(0, 300));

const audit = await sql(`
  select created_at, payload->>'action' as action, payload->>'log_type' as type,
         payload->'traits'->>'provider' as provider
  from auth.audit_log_entries order by created_at desc limit 30`);
log("recent auth events:");
for (const a of audit) log(`  ${a.created_at} ${a.action} ${a.type ?? ""} ${a.provider ?? ""}`);

console.log(out.join("\n"));
