# UniswapV3LPOptimizer

The goal of this tool is to give Uniswap V3 users ideas for 'optimal' pool positions (by APY expected value) by using historial price volatility and the current pool liquidity distribution. It was largely inspired by the [Uniswap V3 fees calculator](https://uniswapv3.flipsidecrypto.com/) created by the Flipside team. However, this tool aims to take away a significant amount of manual work in locating positions, rather to allow users to tweak some investment settings (to be implemented soon) and automatically see a table of liquidity providing opportunities with start and end price points.

Here is the rough calculation used for finding the APY of a given position:

- Find the average daily volume of a pool averaged over a week
- Calculate the liquidity of a potential position for start and end points. Currently setting the tick size to 1/4 of a standard deviation. I'm also assuming a $1000 USD position value which can be tweaked in the future.
- Calculate a distribution of the existing liquidity overlapping with each bucket. This is similar to the views in both the flipside calculator and the liquidity view of the Uniswap analytics dashboard.
- Use the normal distribution of the price pair (using one week of daily price movement to calculate volatility = standard deviation) to calculate the probability of the price being in each bucket. This of course makes the incorrect assumption that the past volatility will reflect the future, but hey, we gotta start somewhere. We can sum up all the buckets of the total start/end range to get an expected value for total 'liquidity coverage'.
- Pulling everything together the calculation comes out to:
  - Daily Fees = Pool Volume * Pool Fee % * Liquidity Coverage Expected Value
  - APY = (Daily Fees / 1000) * 365
- Finally choose the highest APY position for each pool

Also see some of the math in the [Uniswap V3 fees calculator](https://uniswapv3.flipsidecrypto.com/) for more info on how liquidity is calculated. (Info used in the Discord channel was also leveraged)

NOTE: There are a number of parameter preset values that are being used to get rid of noise in the data. For example, the lower volume pools are excluded from result, and extremely aggressive positions are ignored. I aim to document these are make they controllable in the UI soon

DISCLAIMER:
This tool is not investment advice, please use it at your own risk. It uses a point-in-time estimate of how much you could potentially earn in fees for providing liquidity in Uniswap V3 (similar to the Flipside calculator). It assumes no changes to swap price, swap volumes or liquidity positions which is not realistic. It also does not account for Impermanent Loss currently. Use it to make directionally decisions about investments, but past information makes no gaurantees about the future.