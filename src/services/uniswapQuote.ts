import {
  BrowserProvider,
  Contract,
  formatUnits,
  parseUnits,
  solidityPacked,
} from "ethers";
import type { LiveHopQuote } from "./quoteTypes";

export const ETHEREUM_MAINNET_CHAIN_ID = 1n;

const QUOTER_V2_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// USDT → WETH (0.05%) → USDC (0.05%) → USDT (0.01%)
const PATH = solidityPacked(
  ["address", "uint24", "address", "uint24", "address", "uint24", "address"],
  [USDT_ADDRESS, 500, WETH_ADDRESS, 500, USDC_ADDRESS, 100, USDT_ADDRESS],
);

const QUOTER_ABI = [
  "function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
];

export type LiveEthereumQuote = {
  amountIn: string;
  amountOut: string;
  gasEstimate: string;
  blockNumber: number;
  quotedAt: number;
  hops: LiveHopQuote[];
};

export async function quoteEthereumUniswapCycle(
  amount: string,
  provider: BrowserProvider,
): Promise<LiveEthereumQuote> {
  const amountIn = parseUnits(amount, 6);
  if (amountIn <= 0n) {
    throw new Error("Enter a USDT amount greater than zero.");
  }

  const network = await provider.getNetwork();
  if (network.chainId !== ETHEREUM_MAINNET_CHAIN_ID) {
    throw new Error("Switch your wallet to Ethereum Mainnet to request this quote.");
  }

  const blockNumber = await provider.getBlockNumber();
  const quoter = new Contract(QUOTER_V2_ADDRESS, QUOTER_ABI, provider);
  const quote = await quoter.getFunction("quoteExactInput").staticCall(PATH, amountIn, { blockTag: blockNumber });
  const hopConfig = [
    { tokenIn: "USDT", tokenOut: "WETH", addressIn: USDT_ADDRESS, addressOut: WETH_ADDRESS, decimalsIn: 6, decimalsOut: 18, fee: 500, feeDescription: "0.05% pool fee" },
    { tokenIn: "WETH", tokenOut: "USDC", addressIn: WETH_ADDRESS, addressOut: USDC_ADDRESS, decimalsIn: 18, decimalsOut: 6, fee: 500, feeDescription: "0.05% pool fee" },
    { tokenIn: "USDC", tokenOut: "USDT", addressIn: USDC_ADDRESS, addressOut: USDT_ADDRESS, decimalsIn: 6, decimalsOut: 6, fee: 100, feeDescription: "0.01% pool fee" },
  ];
  let hopAmountIn = amountIn;
  const hops: LiveHopQuote[] = [];
  for (const hop of hopConfig) {
    const hopPath = solidityPacked(
      ["address", "uint24", "address"],
      [hop.addressIn, hop.fee, hop.addressOut],
    );
    const hopQuote = await quoter.getFunction("quoteExactInput").staticCall(hopPath, hopAmountIn, { blockTag: blockNumber });
    hops.push({
      tokenIn: hop.tokenIn,
      tokenOut: hop.tokenOut,
      amountIn: formatUnits(hopAmountIn, hop.decimalsIn),
      amountOut: formatUnits(hopQuote[0], hop.decimalsOut),
      venue: "Uniswap V3",
      feeDescription: hop.feeDescription,
    });
    hopAmountIn = hopQuote[0];
  }

  return {
    amountIn: formatUnits(amountIn, 6),
    amountOut: formatUnits(quote[0], 6),
    gasEstimate: quote[3].toString(),
    blockNumber,
    quotedAt: Date.now(),
    hops,
  };
}
