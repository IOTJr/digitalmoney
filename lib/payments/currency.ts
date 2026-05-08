export interface KesQuote {
  kesAmount: number;
  usdToKesRate: number;
  source: "live" | "fallback";
}

const DEFAULT_USD_TO_KES_RATE = 130;

function resolveFallbackRate() {
  const configured = Number(process.env.STATIC_USD_TO_KES_RATE || "");
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return DEFAULT_USD_TO_KES_RATE;
}

export async function getKesQuoteFromUsd(usdAmount: number): Promise<KesQuote> {
  const fallbackRate = resolveFallbackRate();

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Exchange rate request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      rates?: Record<string, number>;
    };

    const liveRate = payload?.rates?.KES;
    if (!liveRate || !Number.isFinite(liveRate)) {
      throw new Error("KES exchange rate not present in API response");
    }

    return {
      kesAmount: Math.round(usdAmount * liveRate),
      usdToKesRate: liveRate,
      source: "live",
    };
  } catch {
    return {
      kesAmount: Math.round(usdAmount * fallbackRate),
      usdToKesRate: fallbackRate,
      source: "fallback",
    };
  }
}
