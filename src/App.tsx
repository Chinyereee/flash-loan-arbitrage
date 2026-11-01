import { useEffect, useState } from "react";
import { BrowserProvider, type Eip1193Provider } from "ethers";
import { quoteEthereumUniswapCycle, type LiveEthereumQuote } from "./services/uniswapQuote";
import { quoteSolanaCycle, type LiveSolanaQuote } from "./services/jupiterQuote";
import { quoteBalancerCycle, quoteSushiCycle, type LiveEthereumDexQuote } from "./services/ethereumDexQuotes";
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
  tokens: string[];
  providers: ProviderQuote[];
};

const routes: Route[] = [
  {
    id: "ethereum",
    title: "Ethereum",
    network: "Ethereum Mainnet · Chain 1",
    tokens: ["USDT", "WETH", "USDC", "USDT"],
    providers: [
      { id: "uniswap", name: "Uniswap V3", mark: "UNI", description: "Three-hop route · live quote when connected", fee: "0.05% · 0.05% · 0.01%", gas: "165k units" },
      { id: "sushi", name: "SushiSwap", mark: "S", description: "Sushi V2 route · live on-chain quote", fee: "0.30%", gas: "157k units" },
      { id: "balancer", name: "Balancer", mark: "B", description: "Balancer SOR route · live pool quote", fee: "0.10%", gas: "157k units" },
    ],
  },
  {
    id: "solana",
    title: "Solana",
    network: "Solana Mainnet",
    tokens: ["USDT", "SOL", "USDC", "USDT"],
    providers: [
      { id: "jupiter", name: "Jupiter", mark: "JUP", description: "Meta-aggregator route · live read-only quote", output: "10,031.46", fee: "0.20%", gas: "0.0008 SOL", best: true },
      { id: "raydium", name: "Raydium", mark: "R", description: "AMM route · demo quote", output: "10,028.10", fee: "0.25%", gas: "0.0007 SOL" },
    ],
  },
  {
    id: "other",
    title: "Other network",
    network: "Base, BNB Chain, or Polygon",
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
  const [flashProvider, setFlashProvider] = useState("Aave V3");
  const [capitalAmount, setCapitalAmount] = useState("10000");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [readProvider, setReadProvider] = useState<BrowserProvider | null>(null);
  const [liveQuote, setLiveQuote] = useState<LiveEthereumQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [quoteError, setQuoteError] = useState("");
  const [liveSushiQuote, setLiveSushiQuote] = useState<LiveEthereumDexQuote | null>(null);
  const [sushiQuoteStatus, setSushiQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [sushiQuoteError, setSushiQuoteError] = useState("");
  const [liveBalancerQuote, setLiveBalancerQuote] = useState<LiveEthereumDexQuote | null>(null);
  const [balancerQuoteStatus, setBalancerQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [balancerQuoteError, setBalancerQuoteError] = useState("");
  const [liveSolanaQuote, setLiveSolanaQuote] = useState<LiveSolanaQuote | null>(null);
  const [solanaQuoteStatus, setSolanaQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [solanaQuoteError, setSolanaQuoteError] = useState("");
  const [walletError, setWalletError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRouteId, setReviewRouteId] = useState("ethereum");
  const [signatureSimulated, setSignatureSimulated] = useState(false);
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

  useEffect(() => {
    if (!readProvider) {
      setLiveSushiQuote(null);
      setSushiQuoteStatus("idle");
      setSushiQuoteError("");
      return;
    }
    if (!capitalAmount.trim() || !Number.isFinite(Number(capitalAmount)) || Number(capitalAmount) <= 0) {
      setLiveSushiQuote(null);
      setSushiQuoteStatus("idle");
      setSushiQuoteError("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSushiQuoteStatus("loading");
      setSushiQuoteError("");
      setLiveSushiQuote(null);
      try {
        const quote = await quoteSushiCycle(capitalAmount, readProvider);
        if (!cancelled) {
          setLiveSushiQuote(quote);
          setSushiQuoteStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setSushiQuoteStatus("error");
          setSushiQuoteError(error instanceof Error ? error.message : "Could not fetch a SushiSwap quote.");
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [capitalAmount, readProvider]);

  useEffect(() => {
    if (!capitalAmount.trim() || !/^\d+(\.\d*)?$/.test(capitalAmount) || Number(capitalAmount) <= 0) {
      setLiveBalancerQuote(null);
      setBalancerQuoteStatus("idle");
      setBalancerQuoteError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBalancerQuoteStatus("loading");
      setBalancerQuoteError("");
      setLiveBalancerQuote(null);
      try {
        const quote = await quoteBalancerCycle(capitalAmount, controller.signal);
        if (!controller.signal.aborted) {
          setLiveBalancerQuote(quote);
          setBalancerQuoteStatus("ready");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setBalancerQuoteStatus("error");
          setBalancerQuoteError(error instanceof Error ? error.message : "Could not fetch a Balancer quote.");
        }
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [capitalAmount]);

  useEffect(() => {
    if (selectedProviders.solana !== "jupiter") {
      setLiveSolanaQuote(null);
      setSolanaQuoteStatus("idle");
      setSolanaQuoteError("");
      return;
    }
    if (!capitalAmount.trim() || !/^\d+(\.\d*)?$/.test(capitalAmount) || Number(capitalAmount) <= 0) {
      setLiveSolanaQuote(null);
      setSolanaQuoteStatus("idle");
      setSolanaQuoteError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSolanaQuoteStatus("loading");
      setSolanaQuoteError("");
      setLiveSolanaQuote(null);
      try {
        const quote = await quoteSolanaCycle(capitalAmount, controller.signal);
        if (!controller.signal.aborted) {
          setLiveSolanaQuote(quote);
          setSolanaQuoteStatus("ready");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setSolanaQuoteStatus("error");
          setSolanaQuoteError(error instanceof Error ? error.message : "Could not fetch a Jupiter quote.");
        }
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [capitalAmount, selectedProviders.solana]);

  useEffect(() => {
    if (!reviewOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setReviewOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [reviewOpen]);

  function chooseProvider(routeId: string, providerId: string) {
    setSelectedProviders((current) => ({ ...current, [routeId]: providerId }));
    setOpenRoute(null);
    setSearch("");
  }

  const pageNoticeError = Boolean(walletError || quoteStatus === "error" || sushiQuoteStatus === "error" || balancerQuoteStatus === "error" || solanaQuoteStatus === "error");
  let pageNotice = "Balancer is requesting a live pool quote. Connect an Ethereum wallet to quote Uniswap and SushiSwap.";
  if (walletError) pageNotice = walletError;
  else if (solanaQuoteStatus === "error") pageNotice = solanaQuoteError;
  else if (quoteStatus === "error") pageNotice = quoteError;
  else if (sushiQuoteStatus === "error") pageNotice = sushiQuoteError;
  else if (balancerQuoteStatus === "error") pageNotice = balancerQuoteError;
  else if (solanaQuoteStatus === "loading") pageNotice = "Requesting three read-only Jupiter quotes. This route can take a few seconds due to public API rate limits.";
  else if (quoteStatus === "loading" || sushiQuoteStatus === "loading" || balancerQuoteStatus === "loading") pageNotice = "Loading live Ethereum provider quotes. Uniswap and SushiSwap use your connected Ethereum wallet; Balancer uses its Smart Order Router.";
  else if ((quoteStatus === "ready" && liveQuote) || (sushiQuoteStatus === "ready" && liveSushiQuote) || (balancerQuoteStatus === "ready" && liveBalancerQuote) || (solanaQuoteStatus === "ready" && liveSolanaQuote)) {
    pageNotice = "Ethereum quotes are live for Uniswap, SushiSwap, and Balancer when their status reads LIVE. Solana Jupiter is quote-only; no transaction is sent.";
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
          <span className="demo-banner">LIVE QUOTES · UNISWAP · SUSHISWAP · BALANCER · JUPITER</span>
        </section>

        <section className="borrow" aria-label="Route amount">
          <label className="borrow-input-label" htmlFor="route-amount">Borrow amount</label>
          <div className="borrow-input-wrap">
            <input
              id="route-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={capitalAmount}
              onChange={(event) => { setCapitalAmount(event.target.value); setLiveQuote(null); setQuoteStatus("idle"); setQuoteError(""); setLiveSushiQuote(null); setSushiQuoteStatus("idle"); setSushiQuoteError(""); setLiveBalancerQuote(null); setBalancerQuoteStatus("idle"); setBalancerQuoteError(""); setLiveSolanaQuote(null); setSolanaQuoteStatus("idle"); setSolanaQuoteError(""); }}
              aria-describedby="amount-note"
            />
            <span>USDT</span>
          </div>
          <span className="borrow-pill">Flash route closes in USDT</span>
          <span className="borrow-hint" id="amount-note">Ethereum and Jupiter use live quotes. Demo providers are marked.</span>
        </section>

        <section className="capital-panel borrow-board" aria-label="Borrow setup">
          <div className="capital-heading">
            <div className="borrow-heading-copy">
              <p className="field-caption">FUNDING · STEP 02</p>
              <h2>Borrow setup</h2>
              <p>Choose where the route gets its starting capital.</p>
            </div>
            <div className="capital-switch" role="group" aria-label="Borrow type">
              <button className={capitalMode === "flash" ? "mode-button mode-selected" : "mode-button"} type="button" aria-pressed={capitalMode === "flash"} onClick={() => setCapitalMode("flash")}>Flash loan</button>
              <button className={capitalMode === "collateral" ? "mode-button mode-selected" : "mode-button"} type="button" aria-pressed={capitalMode === "collateral"} onClick={() => setCapitalMode("collateral")}>Collateral borrow</button>
            </div>
          </div>
          {capitalMode === "flash" ? (
            <>
              <div className="borrow-summary-grid">
                <label className="borrow-summary-item borrow-source-select">
                  <span>Loan provider</span>
                  <select value={flashProvider} onChange={(event) => setFlashProvider(event.target.value)}>
                    <option>Aave V3</option>
                    <option>Uniswap V3</option>
                  </select>
                </label>
                <div className="borrow-summary-item"><span>Loan principal</span><strong>{formatUsdt(capitalAmount)} USDT</strong></div>
                <div className="borrow-summary-item"><span>Loan fee</span><strong>Provider quote required</strong></div>
                <div className="borrow-summary-item"><span>Repayment</span><strong>Principal + fee · same transaction</strong></div>
              </div>
              <p className="capital-note">This board configures the funding leg. The app does not request a loan; the lender fee and repayment check are not connected yet.</p>
            </>
          ) : (
            <div className="collateral-fields borrow-summary-grid">
              <label className="borrow-summary-item">
                Collateral asset
                <select defaultValue="USDT">
                  <option>USDT · if eligible</option>
                  <option>WETH · if eligible</option>
                  <option>Other supported asset</option>
                </select>
              </label>
              <label className="borrow-summary-item">
                Collateral amount
                <input type="number" min="0" defaultValue="15000" />
              </label>
              <label className="borrow-summary-item">
                Borrow asset
                <select defaultValue="USDT">
                  <option>USDT</option>
                  <option>WETH</option>
                  <option>USDC</option>
                </select>
              </label>
              <div className="borrow-summary-item"><span>Borrow amount</span><strong>{formatUsdt(capitalAmount)} USDT</strong></div>
              <p className="capital-note">Collateral factor, interest, and liquidation risk require live lending-market data and are not estimated here.</p>
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
            const isLiveJupiter = route.id === "solana" && selected.id === "jupiter";
            const isEthereumRoute = route.id === "ethereum";
            const quoteForEthereumProvider = (providerId: string) =>
              providerId === "uniswap" ? liveQuote
                : providerId === "sushi" ? liveSushiQuote
                  : providerId === "balancer" ? liveBalancerQuote
                    : null;
            const statusForEthereumProvider = (providerId: string) =>
              providerId === "uniswap" ? quoteStatus
                : providerId === "sushi" ? sushiQuoteStatus
                  : providerId === "balancer" ? balancerQuoteStatus
                    : "idle";
            const selectedEthereumQuote = isEthereumRoute ? quoteForEthereumProvider(selected.id) : null;
            const displayedOutput = isEthereumRoute
              ? selectedEthereumQuote ? formatUsdt(selectedEthereumQuote.amountOut) : "—"
              : isLiveJupiter && liveSolanaQuote
                ? formatUsdt(liveSolanaQuote.amountOut)
                : formatScaledAmount(selected.output ?? "", capitalAmount);
            const displayedDelta = displayedOutput !== "—"
              ? formatAmountDelta(displayedOutput, capitalAmount)
              : "—";
            const displayedFee = isEthereumRoute
              ? isLiveUniswap && liveQuote ? selected.fee
                : selectedEthereumQuote && "feeDescription" in selectedEthereumQuote
                  ? selectedEthereumQuote.feeDescription
                  : statusForEthereumProvider(selected.id) === "loading" ? "Quoting…" : statusForEthereumProvider(selected.id) === "error" ? "Quote unavailable" : selected.id === "balancer" ? "Waiting for quote" : "Connect wallet"
              : isLiveJupiter && liveSolanaQuote
                ? "DEX fees reflected in quote"
                : selected.fee + " · demo";
            const displayedGas = isEthereumRoute
              ? selectedEthereumQuote?.gasEstimate
                ? Number(selectedEthereumQuote.gasEstimate).toLocaleString("en-US") + " units"
                : selectedEthereumQuote && "gasDescription" in selectedEthereumQuote
                  ? selectedEthereumQuote.gasDescription
                  : statusForEthereumProvider(selected.id) === "loading" ? "Quoting…" : statusForEthereumProvider(selected.id) === "error" ? "Quote unavailable" : selected.id === "balancer" ? "Waiting for quote" : "Connect wallet"
              : isLiveJupiter && liveSolanaQuote
                ? "Not included in quote"
                : selected.gas + " · demo";
            const liveOutputForPicker = (providerId: string) => {
              if (isEthereumRoute) {
                const quote = quoteForEthereumProvider(providerId);
                return quote ? formatUsdt(quote.amountOut) : "—";
              }
              return providerId === "uniswap" && liveQuote
                ? formatUsdt(liveQuote.amountOut)
                : providerId === "jupiter" && liveSolanaQuote
                  ? formatUsdt(liveSolanaQuote.amountOut)
                  : null;
            };

            return (
              <div className="route-column" key={route.id}>
              <article className={pickerOpen ? "route-card route-card-active" : "route-card"}>
                <div className="route-card-heading">
                  <div>
                    <p className="route-index">ROUTE 0{index + 1}</p>
                    <h2>{route.title}</h2>
                    <p className="network-name">{route.network}</p>
                  </div>
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
                              {route.id === "ethereum" ? <span className="best-badge">{quoteForEthereumProvider(provider.id) ? "LIVE" : statusForEthereumProvider(provider.id) === "loading" ? "QUOTING" : statusForEthereumProvider(provider.id) === "error" ? "UNAVAILABLE" : provider.id === "balancer" ? "LIVE QUOTE" : "CONNECT WALLET"}</span> : provider.id === "jupiter" ? <span className="best-badge">{liveSolanaQuote ? "LIVE" : solanaQuoteStatus === "loading" ? "QUOTING" : "LIVE QUOTE"}</span> : provider.best && <span className="best-badge">DEMO</span>}
                            </span>
                            <span className="provider-option-description">{provider.description}</span>
                          </span>
                          <span className="provider-option-quote">
                            {liveOutputForPicker(provider.id) ?? formatScaledAmount(provider.output ?? "", capitalAmount)}
                            <span>USDT out</span>
                          </span>
                        </button>
                      ))}
                      {filteredProviders.length === 0 && <p className="no-providers">No providers match that search.</p>}
                    </div>
                  </div>
                )}

                <div className="route-result" aria-live="polite">
                  <div className="result-label">Estimated final amount</div>
                  <div className="result-amount">{displayedOutput} {displayedOutput !== "—" && <span>USDT</span>}</div>
                  <div className="result-metrics">
                    <div><span>Gross delta</span><strong className="profit-value">{displayedDelta}</strong></div>
                    <div><span>Swap fee</span><strong>{displayedFee}</strong></div>
                    <div><span>Gas estimate</span><strong>{displayedGas}</strong></div>
                  </div>
                  <div className="route-footer">
                    <span>{route.tokens.map((token, tokenIndex) => <span key={route.id + "-path-" + tokenIndex}>{tokenIndex > 0 && <span className="path-divider"> → </span>}{token}</span>)}</span>
                    <span className="demo-tag">{isEthereumRoute ? selectedEthereumQuote ? "LIVE QUOTE" : statusForEthereumProvider(selected.id) === "loading" ? "QUOTING" : "QUOTE UNAVAILABLE" : isLiveJupiter && liveSolanaQuote ? "LIVE QUOTE" : "DEMO"}</span>
                  </div>
                  <button
                    className="route-continue-button"
                    type="button"
                    disabled={isEthereumRoute && !selectedEthereumQuote}
                    onClick={() => { setReviewRouteId(route.id); setSignatureSimulated(false); setReviewOpen(true); }}
                  >
                    <span>Continue with quoted rate</span>
                    <strong>{displayedOutput === "—" ? statusForEthereumProvider(selected.id) === "loading" ? "Getting live quote…" : selected.id === "balancer" || readProvider ? "Quote unavailable" : "Connect wallet to quote" : <>{displayedOutput} USDT <span aria-hidden="true">↗</span></>}</strong>
                  </button>
                </div>
              </article>
              </div>
            );
          })}
        </section>

        <aside className={pageNoticeError ? "route-warning route-warning-error" : "route-warning"} role={pageNoticeError ? "alert" : "status"}>
          <span className="warning-mark" aria-hidden="true">!</span>
          <span>{pageNotice}</span>
        </aside>
        <p className="workspace-footnote">All quotes are read-only and exclude flash-loan fees and full transaction costs. Ethereum Uniswap, SushiSwap, and Balancer use live quote sources; Jupiter uses live Solana quotes. Balancer and Jupiter fetch their cycle quotes one hop at a time, so the quote sequence is not an atomic flash-loan simulation. Other network providers remain examples.</p>
      </div>

      {reviewOpen && (() => {
        const reviewRoute = routes.find((route) => route.id === reviewRouteId) ?? routes[0];
        const reviewProvider = reviewRoute.providers.find((provider) => provider.id === selectedProviders[reviewRoute.id]) ?? reviewRoute.providers[0];
        const isLiveUniswapReview = reviewRoute.id === "ethereum" && reviewProvider.id === "uniswap" && Boolean(liveQuote);
        const isLiveSushiReview = reviewRoute.id === "ethereum" && reviewProvider.id === "sushi" && Boolean(liveSushiQuote);
        const isLiveBalancerReview = reviewRoute.id === "ethereum" && reviewProvider.id === "balancer" && Boolean(liveBalancerQuote);
        const isLiveJupiterReview = reviewRoute.id === "solana" && reviewProvider.id === "jupiter" && Boolean(liveSolanaQuote);
        const isEthereumReview = reviewRoute.id === "ethereum";
        const reviewEthereumQuote = reviewProvider.id === "uniswap" ? liveQuote : reviewProvider.id === "sushi" ? liveSushiQuote : reviewProvider.id === "balancer" ? liveBalancerQuote : null;
        const output = isEthereumReview
          ? reviewEthereumQuote ? formatUsdt(reviewEthereumQuote.amountOut) : "—"
          : isLiveJupiterReview && liveSolanaQuote
            ? formatUsdt(liveSolanaQuote.amountOut)
            : formatScaledAmount(reviewProvider.output ?? "", capitalAmount);
        const quoteIsLive = isLiveUniswapReview || isLiveSushiReview || isLiveBalancerReview || isLiveJupiterReview;

        return (
          <div className="review-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewOpen(false); }}>
            <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title" aria-describedby="review-description">
              <div className="review-dialog-heading">
                <div>
                  <p className="eyebrow">{reviewRoute.network.toUpperCase()}</p>
                  <h2 id="review-title">Review transaction</h2>
                </div>
                <button className="review-close" type="button" aria-label="Close review" autoFocus onClick={() => setReviewOpen(false)}>×</button>
              </div>
              <p className="review-safety-note" id="review-description">
                This is a portfolio demo. The button below simulates a signature in the interface; it will not open MetaMask, sign a real transaction, or send anything.
              </p>
              <dl className="review-details">
                <div><dt>Network</dt><dd>{reviewRoute.title}</dd></div>
                <div><dt>Provider</dt><dd>{reviewProvider.name}</dd></div>
                <div><dt>Route</dt><dd>{reviewRoute.tokens.join(" → ")}</dd></div>
                <div><dt>Capital source</dt><dd>{capitalMode === "flash" ? flashProvider + " flash loan" : "Collateral borrow"}</dd></div>
                <div><dt>Borrow amount</dt><dd>{formatUsdt(capitalAmount)} USDT</dd></div>
                <div><dt>Estimated output</dt><dd>{output}{output !== "—" ? " USDT" : ""} <span>{quoteIsLive ? "LIVE QUOTE" : isEthereumReview ? "QUOTE UNAVAILABLE" : "DEMO FIGURE"}</span></dd></div>
                <div><dt>Gross delta</dt><dd>{formatAmountDelta(output, capitalAmount)} <span>before fees and gas</span></dd></div>
                <div><dt>Transaction</dt><dd>Review only · not executable</dd></div>
              </dl>
              {signatureSimulated && <p className="signature-success" role="status">Demo signature complete. No wallet signature or transaction was created.</p>}
              <div className="review-dialog-actions">
                <button className="review-cancel-button" type="button" onClick={() => setReviewOpen(false)}>Back to route</button>
                <button className="review-sign-button" type="button" onClick={() => setSignatureSimulated(true)}>
                  {signatureSimulated ? "Signed (demo)" : "Sign (demo only)"}
                </button>
              </div>
            </section>
          </div>
        );
      })()}
    </main>
  );
}

export default App;
