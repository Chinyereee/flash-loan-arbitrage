import { useEffect, useState } from "react";
import { BrowserProvider, type Eip1193Provider } from "ethers";
import { quoteEthereumUniswapCycle, type LiveEthereumQuote } from "./services/uniswapQuote";
import "./App.css";

type ProviderQuote = {
  id: string;
  name: string;
  mark: string;
  description: string;
  output?: string;
  fee: string;
  gas: string;
  best?: boolean;
};

type Route = {
  id: string;
  title: string;
  network: string;
  family: string;
  tokens: string[];
  providers: ProviderQuote[];
};

const routes: Route[] = [
  {
    id: "ethereum",
    title: "Ethereum",
    network: "Ethereum Mainnet · Chain 1",
    family: "EVM",
    tokens: ["USDT", "WETH", "USDC", "USDT"],
    providers: [
      { id: "uniswap", name: "Uniswap V3", mark: "UNI", description: "Three-hop Ethereum route · on-chain quote", fee: "0.05% · 0.05% · 0.01%", gas: "Awaiting quote" },
      { id: "sushi", name: "SushiSwap", mark: "S", description: "Constant-product pool · demo quote", output: "10,033.64", fee: "0.30%", gas: "157k units" },
      { id: "balancer", name: "Balancer", mark: "B", description: "Weighted pool · demo quote", output: "10,026.30", fee: "0.10%", gas: "157k units" },
    ],
  },
  {
    id: "solana",
    title: "Solana",
    network: "Solana Mainnet",
    family: "SVM",
    tokens: ["USDT", "SOL", "USDC", "USDT"],
    providers: [
      { id: "jupiter", name: "Jupiter", mark: "JUP", description: "Aggregator route · demo quote", output: "10,031.46", fee: "0.20%", gas: "0.0008 SOL", best: true },
      { id: "raydium", name: "Raydium", mark: "R", description: "AMM route · demo quote", output: "10,028.10", fee: "0.25%", gas: "0.0007 SOL" },
    ],
  },
  {
    id: "other",
    title: "Other network",
    network: "Base, BNB Chain, or Polygon",
    family: "EVM",
    tokens: ["USDT", "WETH", "USDC", "USDT"],
    providers: [
      { id: "aerodrome", name: "Aerodrome · Base", mark: "A", description: "Base network · demo quote", output: "10,019.88", fee: "0.30%", gas: "142k units", best: true },
      { id: "pancake", name: "PancakeSwap · BNB Chain", mark: "P", description: "BNB Chain · demo quote", output: "10,018.72", fee: "0.25%", gas: "156k units" },
      { id: "quick", name: "QuickSwap · Polygon", mark: "Q", description: "Polygon network · demo quote", output: "10,015.20", fee: "0.30%", gas: "174k units" },
    ],
  },
];

const BASE_CAPITAL = 10_000;

function scaledValue(value: string, amount: string): number | null {
  const inputAmount = Number(amount);
  const baseValue = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(inputAmount) || inputAmount < 0 || !Number.isFinite(baseValue)) {
    return null;
  }
  return baseValue * (inputAmount / BASE_CAPITAL);
}

function formatScaledAmount(value: string, amount: string): string {
  const scaled = scaledValue(value, amount);
  if (scaled === null) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(scaled);
}



function formatUsdt(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatAmountDelta(output: string, input: string): string {
  const outputValue = Number(output.replace(/,/g, ""));
  const inputValue = Number(input);
  if (!Number.isFinite(outputValue) || !Number.isFinite(inputValue)) return "—";
  const delta = outputValue - inputValue;
  return (delta >= 0 ? "+$" : "−$") + Math.abs(delta).toFixed(2);
}

function App() {
  const [capitalMode, setCapitalMode] = useState<"flash" | "collateral">("flash");
  const [capitalAmount, setCapitalAmount] = useState("10000");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [readProvider, setReadProvider] = useState<BrowserProvider | null>(null);
  const [liveQuote, setLiveQuote] = useState<LiveEthereumQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [quoteError, setQuoteError] = useState("");
  const [walletError, setWalletError] = useState("");
  const [openRoute, setOpenRoute] = useState<string | null>("ethereum");
  const [search, setSearch] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<Record<string, string>>({
    ethereum: "uniswap",
    solana: "jupiter",
    other: "aerodrome",
  });

  async function connectWallet() {
    setWalletError("");
    const injected = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
    if (!injected) {
      setWalletError("No browser wallet found. Install or enable MetaMask, then try again.");
      return;
    }

    try {
      const provider = new BrowserProvider(injected);
      const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
      if (!accounts[0]) throw new Error("Wallet connection was not approved.");
      setWalletAddress(accounts[0]);
      setReadProvider(provider);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Could not connect to the wallet.");
    }
  }

  useEffect(() => {
    if (!readProvider) return;
    if (!capitalAmount.trim() || !Number.isFinite(Number(capitalAmount)) || Number(capitalAmount) <= 0) {
      setLiveQuote(null);
      setQuoteStatus("idle");
      setQuoteError("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setQuoteStatus("loading");
      setQuoteError("");
      setLiveQuote(null);
      try {
        const quote = await quoteEthereumUniswapCycle(capitalAmount, readProvider);
        if (!cancelled) {
          setLiveQuote(quote);
          setQuoteStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setQuoteStatus("error");
          setQuoteError(error instanceof Error ? error.message : "Could not fetch an on-chain quote.");
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [capitalAmount, readProvider]);

  function chooseProvider(routeId: string, providerId: string) {
    setSelectedProviders((current) => ({ ...current, [routeId]: providerId }));
    setOpenRoute(null);
    setSearch("");
  }

  return (
    <main className="route-studio">
      <header className="studio-topbar">
        <div className="studio-brand">
          <span className="brand-symbol">R</span>
          <span>ROUTE LAB</span>
          <span className="brand-divider">/</span>
          <span className="brand-section">Workspace</span>
        </div>
        <div className="topbar-actions">
          <span className="simulation-status"><span className="status-dot" />{walletAddress ? "WALLET CONNECTED · READ ONLY" : "READ-ONLY QUOTES"}</span>
          <button className="connect-wallet" type="button" onClick={connectWallet}>{walletAddress ? walletAddress.slice(0, 6) + "…" + walletAddress.slice(-4) : "Connect wallet"}</button>
        </div>
      </header>

      <div className="studio-content">
        <section className="studio-heading">
          <div>
            <p className="eyebrow">ROUTE COMPARISON</p>
            <h1>Choose an execution provider</h1>
            <p className="heading-copy">Compare provider quotes across three fixed network routes.</p>
          </div>
          <span className="demo-banner">UNISWAP V3 ON-CHAIN · OTHER PROVIDERS DEMO</span>
        </section>
        {walletError && <p className="wallet-error" role="alert">{walletError}</p>}

        <section className="borrow" aria-label="Route amount">
          <label className="borrow-input-label" htmlFor="route-amount">Route amount</label>
          <div className="borrow-input-wrap">
            <input
              id="route-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={capitalAmount}
              onChange={(event) => { setCapitalAmount(event.target.value); setLiveQuote(null); setQuoteStatus("idle"); setQuoteError(""); }}
              aria-describedby="amount-note"
            />
            <span>USDT</span>
          </div>
          <span className="borrow-pill">Flash route closes in USDT</span>
          <span className="borrow-hint" id="amount-note">Demo providers scale proportionally; Uniswap reads the current on-chain quote.</span>
        </section>

        <section className="capital-panel" aria-label="Simulation capital source">
          <div className="capital-heading">
            <div>
              <p className="field-caption">CAPITAL SOURCE</p>
              <div className="capital-switch" role="group" aria-label="Capital source">
                <button className={capitalMode === "flash" ? "mode-button mode-selected" : "mode-button"} type="button" aria-pressed={capitalMode === "flash"} onClick={() => setCapitalMode("flash")}>Flash loan</button>
                <button className={capitalMode === "collateral" ? "mode-button mode-selected" : "mode-button"} type="button" aria-pressed={capitalMode === "collateral"} onClick={() => setCapitalMode("collateral")}>Collateral borrow</button>
              </div>
            </div>
          </div>
          {capitalMode === "flash" ? (
            <p className="capital-note">No collateral is posted for the flash loan. The route must return USDT plus its fee in the same transaction.</p>
          ) : (
            <div className="collateral-fields">
              <label>
                Collateral asset
                <select defaultValue="USDT">
                  <option>USDT · if eligible</option>
                  <option>WETH · if eligible</option>
                  <option>Other supported asset</option>
                </select>
              </label>
              <label>
                Borrow asset
                <select defaultValue="WETH">
                  <option>WETH</option>
                  <option>USDC</option>
                  <option>USDT</option>
                </select>
              </label>
              <p>Borrowing adds interest and liquidation risk. Only market-supported assets are available.</p>
            </div>
          )}
        </section>

        <section className="route-grid" aria-label="Network route workspaces">
          {routes.map((route, index) => {
            const selected =
              route.providers.find((provider) => provider.id === selectedProviders[route.id]) ??
              route.providers[0];
            const filteredProviders = route.providers.filter((provider) =>
              provider.name.toLowerCase().includes(search.toLowerCase()),
            );
            const pickerOpen = openRoute === route.id;
            const isLiveUniswap = route.id === "ethereum" && selected.id === "uniswap";
            const displayedOutput = isLiveUniswap
              ? liveQuote ? formatUsdt(liveQuote.amountOut) : null
              : formatScaledAmount(selected.output ?? "", capitalAmount);
            const displayedDelta = displayedOutput
              ? formatAmountDelta(displayedOutput, capitalAmount)
              : "—";
            const displayedFee = isLiveUniswap
              ? selected.fee
              : selected.fee + " · demo";
            const displayedGas = isLiveUniswap && liveQuote
              ? Number(liveQuote.gasEstimate).toLocaleString("en-US") + " units"
              : selected.gas;

            return (
              <article className={pickerOpen ? "route-card route-card-active" : "route-card"} key={route.id}>
                <div className="route-card-heading">
                  <div>
                    <p className="route-index">ROUTE 0{index + 1}</p>
                    <h2>{route.title}</h2>
                    <p className="network-name">{route.network}</p>
                  </div>
                  <span className="network-family">{route.family}</span>
                </div>


                <button
                  className="provider-trigger"
                  type="button"
                  aria-expanded={pickerOpen}
                  aria-controls={route.id + "-provider-list"}
                  onClick={() => setOpenRoute(pickerOpen ? null : route.id)}
                >
                  <span className="provider-leading">
                    <span className="provider-mark">{selected.mark}</span>
                    <span>
                      <span className="provider-name">{selected.name}</span>
                      <span className="provider-description">Selected provider</span>
                    </span>
                  </span>
                  <span className="provider-chevron" aria-hidden="true">{pickerOpen ? "⌃" : "⌄"}</span>
                </button>

                {pickerOpen && (
                  <div className="provider-picker" id={route.id + "-provider-list"}>
                    <input
                      className="provider-search"
                      type="search"
                      aria-label={"Search " + route.title + " providers"}
                      placeholder="Search providers…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <div className="provider-options">
                      {filteredProviders.map((provider) => (
                        <button
                          className={provider.id === selected.id ? "provider-option provider-option-selected" : "provider-option"}
                          type="button"
                          key={provider.id}
                          onClick={() => chooseProvider(route.id, provider.id)}
                        >
                          <span className="provider-option-copy">
                            <span className="provider-option-title">
                              <span className="provider-mark provider-mark-small">{provider.mark}</span>
                              {provider.name}
                              {provider.id === "uniswap" && liveQuote ? <span className="best-badge">LIVE</span> : provider.best && <span className="best-badge">DEMO</span>}
                            </span>
                            <span className="provider-option-description">{provider.description}</span>
                          </span>
                          <span className="provider-option-quote">
                            {provider.id === "uniswap" ? (liveQuote ? formatUsdt(liveQuote.amountOut) : "—") : formatScaledAmount(provider.output ?? "", capitalAmount)}
                            <span>USDT out</span>
                          </span>
                        </button>
                      ))}
                      {filteredProviders.length === 0 && <p className="no-providers">No providers match that search.</p>}
                    </div>
                  </div>
                )}

                <div className="route-result" aria-live="polite">
                  {isLiveUniswap && (
                    <p className={quoteStatus === "error" ? "quote-status quote-error" : "quote-status"} role="status">
                      {quoteStatus === "loading" && "Fetching a read-only Uniswap quote…"}
                      {quoteStatus === "ready" && liveQuote && "LIVE ON-CHAIN QUOTE · BLOCK " + liveQuote.blockNumber}
                      {quoteStatus === "error" && quoteError}
                      {quoteStatus === "idle" && (walletAddress ? "Waiting for quote…" : "Connect a wallet to fetch a live quote. No transaction will be sent.")}
                    </p>
                  )}
                  <div className="result-label">Estimated final amount</div>
                  <div className="result-amount">{displayedOutput ?? (quoteStatus === "error" ? "Unavailable" : "Connect wallet")} {displayedOutput && <span>USDT</span>}</div>
                  <div className="result-metrics">
                    <div><span>Gross delta</span><strong className="profit-value">{displayedDelta}</strong></div>
                    <div><span>Swap fee</span><strong>{displayedFee}</strong></div>
                    <div><span>Gas estimate</span><strong>{displayedGas}</strong></div>
                  </div>
                  <div className="route-footer">
                    <span>{route.tokens.map((token, tokenIndex) => <span key={route.id + "-path-" + tokenIndex}>{tokenIndex > 0 && <span className="path-divider"> → </span>}{token}</span>)}</span>
                    <span className="demo-tag">{isLiveUniswap && liveQuote ? "ON-CHAIN" : "DEMO"}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <p className="workspace-footnote">Gross delta is output minus input; it excludes loan fees and full transaction gas. Only the Ethereum Uniswap V3 quote is on-chain; other providers remain demo data.</p>
      </div>
    </main>
  );
}

export default App;
