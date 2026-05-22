export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Exchange rate API returned ${res.status}`);
    }

    const data = await res.json() as {
      result: string;
      rates: Record<string, number>;
      time_last_update_utc?: string;
    };

    if (data.result !== "success" || !data.rates?.PHP) {
      throw new Error("Invalid response from exchange rate API");
    }

    return NextResponse.json(
      {
        rate: data.rates.PHP,
        updatedAt: data.time_last_update_utc ?? null,
        source: "open.er-api.com",
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        rate: 56.5,
        updatedAt: null,
        source: "fallback",
        error: message,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
