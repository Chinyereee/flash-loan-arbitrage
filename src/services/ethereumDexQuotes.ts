import { Contract, formatUnits, parseUnits, type BrowserProvider } from "ethers";
import type { LiveHopQuote } from "./quoteTypes";

const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const SUSHI_V2_ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
const BALANCER_API = "https://api-v3.balancer.fi/";

const SUSHI_ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)",
];

type BalancerPathsResponse = {
  data?: { sorGetSwapPaths?: { paths?: Array<{ outputAmountRaw?: string }> } };
  errors?: Array<{ message?: string }>;
};

export type LiveEthereumDexQuote = {
  amountOut: string;
  blockNumber?: number;
  quotedAt: number;
  hops: LiveHopQuote[];
  gasEstimate?: string;
  feeDescription: string;
  gasDescription: string;
};

export async function quoteSushiCycle(amount: string, provider: BrowserProvider): Promise<LiveEthereumDexQuote> {
  const network = await provider.getNetwork();
  if (network.chainId !== 1n) throw new Error("Switch your wallet to Ethereum Mainnet to quote SushiSwap.");

  const amountIn = parseUnits(amount, 6);
  if (amountIn <= 0n) throw new Error("Enter a USDT amount greater than zero.");

  const router = new Contract(SUSHI_V2_ROUTER, SUSHI_ROUTER_ABI, provider);
  const amounts = await router.getFunction("getAmountsOut").staticCall(amountIn, [USDT, WETH, USDC, USDT]);
  const blockNumber = await provider.getBlockNumber();

  return {
    amountOut: formatUnits(amounts[3], 6),
    blockNumber,
    quotedAt: Date.now(),
    hops: [
      { tokenIn: "USDT", tokenOut: "WETH", amountIn: formatUnits(amounts[0], 6), amountOut: formatUnits(amounts[1], 18), venue: "SushiSwap V2", feeDescription: "0.30% pool fee" },
      { tokenIn: "WETH", tokenOut: "USDC", amountIn: formatUnits(amounts[1], 18), amountOut: formatUnits(amounts[2], 6), venue: "SushiSwap V2", feeDescription: "0.30% pool fee" },
      { tokenIn: "USDC", tokenOut: "USDT", amountIn: formatUnits(amounts[2], 6), amountOut: formatUnits(amounts[3], 6), venue: "SushiSwap V2", feeDescription: "0.30% pool fee" },
    ],
    feeDescription: "0.30% per pool · on-chain",
    gasDescription: "Quote only · gas not estimated",
  };
}

async function quoteBalancerHop(tokenIn: string, tokenOut: string, amountIn: string, decimalsOut: number, signal?: AbortSignal) {
  if (!/^\d+(\.\d*)?$/.test(amountIn)) throw new Error("Balancer quote amount must be a positive decimal.");
  const query = `{
    sorGetSwapPaths(
      chain: MAINNET
      swapAmount: "${amountIn}"
      swapType: EXACT_IN
      tokenIn: "${tokenIn.toLowerCase()}"
      tokenOut: "${tokenOut.toLowerCase()}"
    ) {
      paths { outputAmountRaw }
    }
  }`;

  const response = await fetch(BALANCER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!response.ok) throw new Error(`Balancer quote failed (${response.status}).`);

  const result = (await response.json()) as BalancerPathsResponse;
  if (result.errors?.length) throw new Error(result.errors[0].message || "Balancer could not quote this hop.");
  const paths = result.data?.sorGetSwapPaths?.paths ?? [];
  if (paths.length === 0) throw new Error("Balancer found no pool route for one of these swaps.");

  const outputRaw = paths.reduce((total, path) => total + BigInt(path.outputAmountRaw ?? "0"), 0n);
  if (outputRaw <= 0n) throw new Error("Balancer returned an empty quote.");
  return formatUnits(outputRaw, decimalsOut);
}

export async function quoteBalancerCycle(amount: string, signal?: AbortSignal): Promise<LiveEthereumDexQuote> {
  const first = await quoteBalancerHop(USDT, WETH, amount, 18, signal);
  const second = await quoteBalancerHop(WETH, USDC, first, 6, signal);
  const third = await quoteBalancerHop(USDC, USDT, second, 6, signal);

  return {
    amountOut: third,
    quotedAt: Date.now(),
    hops: [
      { tokenIn: "USDT", tokenOut: "WETH", amountIn: amount, amountOut: first, venue: "Balancer SOR", feeDescription: "Pool fee included in quote" },
      { tokenIn: "WETH", tokenOut: "USDC", amountIn: first, amountOut: second, venue: "Balancer SOR", feeDescription: "Pool fee included in quote" },
      { tokenIn: "USDC", tokenOut: "USDT", amountIn: second, amountOut: third, venue: "Balancer SOR", feeDescription: "Pool fee included in quote" },
    ],
    feeDescription: "Balancer pool fees · live route",
    gasDescription: "Quote only · gas not estimated",
  };
}
