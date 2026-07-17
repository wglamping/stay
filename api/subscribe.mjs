const json = (response, status, body) => {
  response.status(status);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  return response.json(body);
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_GROUP_ID;
  const allowedOrigins = (process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const origin = request.headers.origin || "";

  if (!apiKey || !groupId) {
    console.error("Missing MailerLite environment configuration.");
    return json(response, 500, { error: "Subscription service is not configured" });
  }

  if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) {
    return json(response, 403, { error: "Origin not allowed" });
  }

  const body = typeof request.body === "string"
    ? JSON.parse(request.body || "{}")
    : (request.body || {});

  if (body.website) {
    return json(response, 200, { ok: true });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email) || email.length > 254) {
    return json(response, 400, { error: "Enter a valid email address" });
  }

  const fields = {
    wg_lead_source: String(body.source || "stay_site").slice(0, 255),
    wg_utm_source: String(body.utm_source || "").slice(0, 255),
    wg_utm_medium: String(body.utm_medium || "").slice(0, 255),
    wg_utm_campaign: String(body.utm_campaign || "").slice(0, 255),
    wg_utm_content: String(body.utm_content || "").slice(0, 255),
    wg_landing_page: String(body.page_url || "").slice(0, 1000),
    wg_form_location: String(body.form_type || "").slice(0, 255)
  };

  try {
    const mailerLiteResponse = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        status: "active",
        groups: [String(groupId)],
        fields
      })
    });

    if (!mailerLiteResponse.ok) {
      const details = await mailerLiteResponse.text();
      console.error("MailerLite subscription failed:", mailerLiteResponse.status, details);
      return json(response, 502, { error: "Unable to complete subscription" });
    }

    return json(response, 200, { ok: true });
  } catch (error) {
    console.error("MailerLite request error:", error);
    return json(response, 502, { error: "Unable to complete subscription" });
  }
}
