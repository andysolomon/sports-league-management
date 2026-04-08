import { getResend, getFromEmail } from "../resend";

interface WelcomeEmailParams {
  to: string;
  firstName?: string | null;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams) {
  const { to, firstName } = params;
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const resend = getResend();

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
      <h1 style="font-size: 24px; margin: 0 0 8px;">Welcome to sprtsmng</h1>
      <p style="color: #71717a; margin: 0 0 24px;">${greeting}</p>

      <p style="margin: 0 0 16px; line-height: 1.6;">
        Thanks for signing up. sprtsmng is the simplest way to run your youth
        sports team — roster, schedule, notifications, all in one place.
      </p>

      <p style="margin: 0 0 16px; line-height: 1.6;">
        You're on the <strong>Free</strong> plan, which means you can manage
        one team with unlimited players, forever.
      </p>

      <h2 style="font-size: 18px; margin: 24px 0 12px;">Get started in 3 steps</h2>
      <ol style="padding-left: 20px; line-height: 1.6;">
        <li style="margin-bottom: 8px;">
          <a href="https://sprtsmng.andrewsolomon.dev/dashboard/leagues" style="color: #2563eb;">
            <strong>Create your first league</strong>
          </a>
          &nbsp;— give it a name and pick a sport.
        </li>
        <li style="margin-bottom: 8px;">
          <a href="https://sprtsmng.andrewsolomon.dev/dashboard/teams" style="color: #2563eb;">
            <strong>Add your team</strong>
          </a>
          &nbsp;— team name, city, colors, founded year.
        </li>
        <li>
          <a href="https://sprtsmng.andrewsolomon.dev/dashboard/players" style="color: #2563eb;">
            <strong>Invite your players</strong>
          </a>
          &nbsp;— add them one at a time or import a CSV.
        </li>
      </ol>

      <div style="margin: 32px 0;">
        <a href="https://sprtsmng.andrewsolomon.dev/dashboard"
           style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Open dashboard
        </a>
      </div>

      <p style="color: #71717a; font-size: 14px; margin: 32px 0 0; line-height: 1.6;">
        Have questions? Reply to this email — it goes to a real person. Or
        share feedback at
        <a href="mailto:feedback@sprtsmng.andrewsolomon.dev" style="color: #2563eb;">
          feedback@sprtsmng.andrewsolomon.dev
        </a>.
      </p>
    </div>
  `;

  return resend.emails.send({
    from: getFromEmail(),
    to,
    subject: "Welcome to sprtsmng",
    html,
  });
}
