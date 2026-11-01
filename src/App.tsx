
function App() {

  return (
    <main>
      <header>
        <p>DEFI / ROUTE LAB</p>
        <h1>Flash Loan Arbitrage</h1>
        <p>
          Build a swap route, estimate its costs, and see whether the numbers
          work.
        </p>
      </header>

      <section>
        <h2>New simulation</h2>
        <p>Your route workspace will appear here as we build it.</p>

        {[
          {
            id: "ethereum",
            title: "Ethereum route",
            providers: ["Uniswap V3", "SushiSwap", "Balancer"],
          },
          {
            id: "solana",
            title: "Solana route",
            providers: ["Jupiter", "Raydium"],
          },
          {
            id: "other",
            title: "Other network route",
            providers: [
              "Aerodrome (Base)",
              "PancakeSwap (BNB Chain)",
              "QuickSwap (Polygon)",
            ],
          },
        ].map((route) => (
          <form key={route.id}>
            <h3>{route.title}</h3>

            <p>
              <label>
                From token{" "}
                <input name={`${route.id}-tokenIn`} placeholder="e.g. USDC" />
              </label>
            </p>

            <p>
              <label>
                To token{" "}
                <input name={`${route.id}-tokenOut`} placeholder="e.g. WETH" />
              </label>
            </p>

            <p>
              <label>
                Provider{" "}
                <select name={`${route.id}-provider`}>
                  {route.providers.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </label>
            </p>
          </form>
        ))}
      </section>
    </main>
  );
}

export default App;