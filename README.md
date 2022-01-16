# Smart Order Router(SOR)



## Intro
* This is the system to find the best aggregation quotes
from all liquidity of dex amm, orderbook and rfq system.
It also provide necessary utils to trade with the best
quotes on chain.



## Install
```bash
# install packages
yarn

# compile typechains and typescript
yarn build

```


## Usage
```bash
# demo
yarn start

# test
yarn test
```


## Docker
```
docker build -t sor_demo .

docker run -it --rm --name sor_demo sor_demo
```


## Development
### code structure
- providers
    - pool provider to collect all pools
    - token provider to collect all tokens
    - quote provider to sample quote on chain
- algorithm
    - use dfs to find all possible trading path that can route from inputToken to outputToken
    - brute force, use bfs to find the best splited route path to meet the need of trader
- swap
    - encode optimized result from output of algorithm and execute calldata on chain to close the trade.

### add new liquidity
1. add pool provider for the new liquidity
2. add placer for the new liquidity
3. add quote provider for the new liquidity
4. add encoder for the new liquidity
