export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" } });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const payload = await request.json();

      // Route: /approve — sends invite email to the pro
      const url = new URL(request.url);
      if (url.pathname === "/approve") {
        return await handleApproval(payload, env);
      }

      // Default: new club registration notification to admin
      return await handleRegistration(payload, env);
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
    }
  },
};

async function handleRegistration(payload, env) {
  const record = payload.record;
  if (!record || !record.name) {
    return new Response("No club data", { status: 400 });
  }

  const emailHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #f59e0b; margin: 0; font-size: 22px;">⚡ MatchGapper</h1>
        <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">Platform Administration</p>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #0f172a; margin: 0 0 16px; font-size: 18px;">New Club Registration</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 120px;">Club</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${record.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">PGA Pro</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${record.pro_name || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Email</td>
            <td style="padding: 8px 0; color: #0f172a;">${record.pro_email || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Status</td>
            <td style="padding: 8px 0;"><span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">PENDING</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Submitted</td>
            <td style="padding: 8px 0; color: #0f172a;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
          <a href="https://matchgapper.com" style="display: inline-block; background: #f59e0b; color: #0f172a; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Review in Platform Admin</a>
        </div>
      </div>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MatchGapper <noreply@matchgapper.com>",
      to: ["tom@axiolo.com"],
      subject: `New Club Registration: ${record.name}`,
      html: emailHtml,
    }),
  });

  const result = await res.json();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: result }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true, emailId: result.id }), { status: 200 });
}

async function handleApproval(payload, env) {
  const { clubName, proName, proEmail, inviteToken } = payload;

  if (!proEmail || !inviteToken) {
    return new Response(JSON.stringify({ error: "Missing proEmail or inviteToken" }), { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const inviteUrl = `https://matchgapper.com?invite=${inviteToken}`;

  const emailHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #f59e0b; margin: 0; font-size: 22px;">⚡ MatchGapper</h1>
        <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">BMW GAP Team Match Manager</p>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 20px;">Welcome to MatchGapper!</h2>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">Your club has been approved. You're all set to get started.</p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 80px;">Club</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${clubName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Role</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">Club Admin</td>
            </tr>
          </table>
        </div>

        <p style="color: #0f172a; font-size: 14px; margin: 0 0 8px; font-weight: 600;">To create your account, click the button below:</p>

        <div style="margin: 20px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Create Your Account</a>
        </div>

        <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0;">This invite link expires in 7 days. If you have trouble, contact us at tom@axiolo.com</p>

        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">Or copy this link: ${inviteUrl}</p>
        </div>
      </div>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MatchGapper <noreply@matchgapper.com>",
      to: [proEmail],
      subject: `${clubName} has been approved on MatchGapper — create your account`,
      html: emailHtml,
    }),
  });

  const result = await res.json();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: result }), { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
  return new Response(JSON.stringify({ success: true, emailId: result.id }), { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
}
