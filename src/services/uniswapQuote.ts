import {
  BrowserProvider,
  Contract,
  formatUnits,
  parseUnits,
  solidityPacked,
} from "ethers";

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

  const quoter = new Contract(QUOTER_V2_ADDRESS, QUOTER_ABI, provider);
  const quote = await quoter.getFunction("quoteExactInput").staticCall(PATH, amountIn);
  const blockNumber = await provider.getBlockNumber();

  return {
    amountIn: formatUnits(amountIn, 6),
    amountOut: formatUnits(quote[0], 6),
    gasEstimate: quote[3].toString(),
    blockNumber,
  };
}
