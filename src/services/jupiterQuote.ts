const JUPITER_ORDER_URL = "https://api.jup.ag/swap/v2/order";

const TOKENS = {
  USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  SOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
} as const;

type JupiterOrder = {
  outAmount?: string;
  router?: string;
  errorMessage?: string;
};

export type LiveSolanaQuote = {
  amountOut: string;
  routers: string[];
};

// Jupiter's no-key bucket is limited to 0.5 requests per second.
let requestQueue: Promise<void> = Promise.resolve();
let previousRequestStartedAt = 0;

function toBaseUnits(amount: string, decimals: number): string {
  const [whole = "0", fraction = ""] = amount.trim().split(".");
  if (fraction.length > decimals) {
    throw new Error(`USDT supports at most ${decimals} decimal places on Solana.`);
  }
  const normalizedWhole = whole || "0";
  const normalizedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return (BigInt(normalizedWhole) * 10n ** BigInt(decimals) + BigInt(normalizedFraction || "0")).toString();
}

function fromBaseUnits(amount: string, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const raw = BigInt(amount);
  const whole = raw / divisor;
  const fraction = (raw % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function getOrder(inputMint: string, outputMint: string, amount: string, signal?: AbortSignal) {
  const request = requestQueue.then(async () => {
    const waitMs = Math.max(0, 2_100 - (Date.now() - previousRequestStartedAt));
    if (waitMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, waitMs);
        signal?.addEventListener("abort", () => {
          window.clearTimeout(timer);
          reject(new DOMException("Quote cancelled", "AbortError"));
        }, { once: true });
      });
    }
    if (signal?.aborted) throw new DOMException("Quote cancelled", "AbortError");
    previousRequestStartedAt = Date.now();

    const params = new URLSearchParams({ inputMint, outputMint, amount });
    const response = await fetch(`${JUPITER_ORDER_URL}?${params}`, { signal });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Jupiter quote failed (${response.status})${details ? `: ${details.slice(0, 160)}` : "."}`);
    }

    const order = (await response.json()) as JupiterOrder;
    if (!order.outAmount) throw new Error(order.errorMessage || "Jupiter returned no quote for this swap.");
    return order;
  });

  requestQueue = request.then(() => undefined, () => undefined);
  return request;
}

export async function quoteSolanaCycle(amountUsdt: string, signal?: AbortSignal): Promise<LiveSolanaQuote> {
  const amountIn = toBaseUnits(amountUsdt, TOKENS.USDT.decimals);
  const first = await getOrder(TOKENS.USDT.mint, TOKENS.SOL.mint, amountIn, signal);
  const second = await getOrder(TOKENS.SOL.mint, TOKENS.USDC.mint, first.outAmount!, signal);
  const third = await getOrder(TOKENS.USDC.mint, TOKENS.USDT.mint, second.outAmount!, signal);

  return {
    amountOut: fromBaseUnits(third.outAmount!, TOKENS.USDT.decimals),
    routers: [first.router, second.router, third.router].filter((router): router is string => Boolean(router)),
  };
}
