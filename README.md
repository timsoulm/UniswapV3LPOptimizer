# UniswapV3LPOptimizer

The goal of this tool is to give Uniswap V3 users ideas for 'optimal' pool positions (by APY expected value) by using historial price volatility and the current pool liquidity distribution. It was largely inspired by the [Uniswap V3 fees calculator](https://uniswapv3.flipsidecrypto.com/) created by the Flipside team. However, this tool aims to take away a significant amount of manual work in locating positions, rather to allow users to tweak some investment settings (to be implemented soon) and automatically see an array of liquidity providing opportunities with start and end price points.

To calculate APY for each position:

- Find the average daily volume of a pool averaged over a week
- Calculate the liquidity of a potential position for start and end points. Currently setting the tick size to 1/4 of a standard deviation. I'm also assuming a $1000 USD position value which can be tweaked in the future.
- Calculate a distribution of the existing liquidity overlapping with each bucket. This is similar to the views in both the flipside calculator and the liquidity view of the Uniswap analytics dashboard.
- Use the normal distribution of the price pair (using one week of daily price movement to calculate volatility = standard deviation) to calculate the probability of the price being in each bucket. This of course makes the incorrect assumption that the past volatility will reflect the future, but hey, we gotta start somewhere. We can sum up all the buckets of the total start/end range to get an expected value for total 'liquidity coverage'.
- Pulling everything together the calculation comes out to:
  - Daily Fees = Pool Volume * Pool Fee % * Liquidity Coverage Expected Value
  - APY = (Daily Fees / 1000) * 365
- Finally choose the highest APY position for each pool

NOTE: There are a number of parameter preset values that are being used to get rid of noise in the data. I aim to document these are make they controllable in the UI soon