import { useState } from "react";
import "./App.css";

type ProviderQuote = {
  id: string;
  name: string;
  mark: string;
  description: string;
  output: string;
  profit: string;
  fee: string;
  gas: string;
  best?: boolean;
  gross?: string;
  loanFee?: string;
  gasCost?: string;
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
      { id: "uniswap", name: "Uniswap V3", mark: "UNI", description: "Concentrated liquidity · 0.30% pool", output: "10,042.18", profit: "+$27.91", fee: "0.30%", gas: "165k units", best: true, gross: "+$42.18", loanFee: "−$5.00", gasCost: "−$9.27" },
      { id: "sushi", name: "SushiSwap", mark: "S", description: "Constant-product pool · demo quote", output: "10,033.64", profit: "+$19.80", fee: "0.30%", gas: "157k units", gross: "+$33.64", loanFee: "−$5.00", gasCost: "−$8.84" },
      { id: "balancer", name: "Balancer", mark: "B", description: "Weighted pool · demo quote", output: "10,026.30", profit: "+$12.46", fee: "0.10%", gas: "157k units", gross: "+$26.30", loanFee: "−$5.00", gasCost: "−$8.84" },
    ],
  },
  {
    id: "solana",
    title: "Solana",
    network: "Solana Mainnet",
    family: "SVM",
    tokens: ["USDT", "SOL", "USDC", "USDT"],
    providers: [
      { id: "jupiter", name: "Jupiter", mark: "JUP", description: "Aggregator route · demo quote", output: "10,031.46", profit: "+$30.80", fee: "0.20%", gas: "0.0008 SOL", best: true },
      { id: "raydium", name: "Raydium", mark: "R", description: "AMM route · demo quote", output: "10,028.10", profit: "+$27.42", fee: "0.25%", gas: "0.0007 SOL" },
    ],
  },
  {
    id: "other",
    title: "Other network",
    network: "Base, BNB Chain, or Polygon",
    family: "EVM",
    tokens: ["USDT", "WETH", "USDC", "USDT"],
    providers: [
      { id: "aerodrome", name: "Aerodrome · Base", mark: "A", description: "Base network · demo quote", output: "10,019.88", profit: "+$13.02", fee: "0.30%", gas: "142k units", best: true },
      { id: "pancake", name: "PancakeSwap · BNB Chain", mark: "P", description: "BNB Chain · demo quote", output: "10,018.72", profit: "+$11.94", fee: "0.25%", gas: "156k units" },
      { id: "quick", name: "QuickSwap · Polygon", mark: "Q", description: "Polygon network · demo quote", output: "10,015.20", profit: "+$8.31", fee: "0.30%", gas: "174k units" },
    ],
  },
];

function App() {
  const [capitalMode, setCapitalMode] = useState<"flash" | "collateral">("flash");
  const [openRoute, setOpenRoute] = useState<string | null>("ethereum");
  const [search, setSearch] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<Record<string, string>>({
    ethereum: "uniswap",
    solana: "jupiter",
    other: "aerodrome",
  });

  const ethereumRoute = routes[0];
  const selectedEthereum =
    ethereumRoute.providers.find((provider) => provider.id === selectedProviders.ethereum) ??
    ethereumRoute.providers[0];

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
          <span className="simulation-status"><span className="status-dot" />LOCAL SIMULATION</span>
          <button className="connect-wallet" type="button">Connect wallet</button>
        </div>
      </header>

      <div className="studio-content">
        <section className="studio-heading">
          <div>
            <p className="eyebrow">ROUTE COMPARISON</p>
            <h1>Choose an execution provider</h1>
            <p className="heading-copy">Compare provider quotes across three fixed network routes.</p>
          </div>
          <span className="demo-banner">DEMO QUOTES · NOT LIVE</span>
        </section>

        <section className="borrow" aria-label="Route amount">
          <div><div className="borrow-label">Route amount</div><div className="borrow-value">10,000.00 USDT</div></div>
          <span className="borrow-pill">Flash route closes in USDT</span>
          <span className="borrow-hint">All quote numbers below are illustrative</span>
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
                              {provider.best && <span className="best-badge">BEST NET</span>}
                            </span>
                            <span className="provider-option-description">{provider.description}</span>
                          </span>
                          <span className="provider-option-quote">
                            {provider.output}
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
                  <div className="result-amount">{selected.output} <span>USDT</span></div>
                  <div className="result-metrics">
                    <div><span>Net profit</span><strong className="profit-value">{selected.profit}</strong></div>
                    <div><span>Swap fee</span><strong>{selected.fee} included</strong></div>
                    <div><span>Gas estimate</span><strong>{selected.gas}</strong></div>
                  </div>
                  {route.id === "ethereum" && (
                    <div className="profit-breakdown">
                      <div><span>Gross difference</span><strong>{selectedEthereum.gross}</strong></div>
                      <div><span>Flash-loan fee · demo</span><strong>{selectedEthereum.loanFee}</strong></div>
                      <div><span>Gas cost · demo</span><strong>{selectedEthereum.gasCost}</strong></div>
                      <div className="breakdown-total"><span>Net estimate</span><strong>{selectedEthereum.profit}</strong></div>
                    </div>
                  )}
                  <div className="route-footer">
                    <span>{route.tokens.map((token, tokenIndex) => <span key={route.id + "-path-" + tokenIndex}>{tokenIndex > 0 && <span className="path-divider"> → </span>}{token}</span>)}</span>
                    <span className="demo-tag">DEMO</span>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <p className="workspace-footnote">All amounts are interface examples, not live market quotes. Network routes are separate simulations.</p>
      </div>
    </main>
  );
}

export default App;
