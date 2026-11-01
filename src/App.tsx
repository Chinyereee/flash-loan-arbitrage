import { useState } from "react";

function App() {
  const [swapCount, setSwapCount] = useState(0);

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

        <label>
          Route chain{" "}
          <select>
            <option value="ethereum">Ethereum</option>
            <option value="solana">Solana</option>
            <option value="other">Base, BNB Chain, Polygon, or random</option>
          </select>
        </label>

          {Array.from({ length: swapCount }, (_, index) => (
            <form key={index}>
              <h3>Swap {index + 1}</h3>

              <p>
                <label>
                  From token{" "}
                  <input name={`tokenIn-${index}`} placeholder="e.g. USDC" />
                </label>
              </p>

              <p>
                <label>
                  To token{" "}
                  <input name={`tokenOut-${index}`} placeholder="e.g. WETH" />
                </label>
              </p>

              <p>
                <label>
                  Exchange{" "}
                  <select name={`dex-${index}`}>
                    <option value="UniswapV3">Uniswap V3</option>
                    <option value="Sushiswap">Sushiswap</option>
                    <option value="Balancer">Balancer</option>
                  </select>
                </label>
              </p>

              <p>
                <label>
                  Pool address{" "}
                  <input name={`poolAddress-${index}`} placeholder="0x..." />
                </label>
              </p>
            </form>
          ))}

          <button type="button" onClick={() => setSwapCount(swapCount + 1)}>
            Add another swap
          </button>
      </section>
    </main>
  );
}

export default App;