import type { APIEvent } from "@solidjs/start/server";

export async function GET({ request }: APIEvent) {
  try {
    // Extract the IP address from the headers
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-client-ip") ||
      "0.0.0.0"; // Use 0.0.0.0 as a fallback

    // Fetch location data using the IP address
    const response = await fetch(
      `https://ipinfo.io/${ip}?token=YOUR_IPINFO_TOKEN`,
    );
    const data = await response.json();

    // Return the JSON response
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch IP location" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
