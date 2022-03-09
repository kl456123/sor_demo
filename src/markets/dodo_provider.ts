import { IRawPoolProvider } from '../rawpool_provider';
import { RawPool, RawToken } from '../types';


type DODOPoolType = {
    address: string;
    name: string;
    tokens: string[];
};

const DODOTokens:Record<string, RawToken> = {
    WOO:{
        address: "0x4691937a7508860F876c9c0a2a617E7d9E945D4B",
        symbol: "WOO",
        },
    COMP:{
        address: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
        symbol: "COMP",
    },
    WETH:{
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        symbol: "WETH",
    },
    USDT:{
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        symbol: "USDT",
    },
    FIN: {
        address: "0x054f76beED60AB6dBEb23502178C52d6C5dEbE40",
        symbol: "FIN",
    },
    LEND: {
        address: "0x80fB784B7eD66730e8b1DBd9820aFD29931aab03",
        symbol: "LEND",
    },
    USDC:{
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        symbol: "USDC",
    },
    WBTC:{
        address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        symbol: "WBTC",
    },
    AAVE:{
        address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
        symbol: "AAVE",
    },
    SNX:{
        address: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
        symbol: "SNX",
    },
    YFI:{
        address: "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e",
        symbol: "YFI",
    },
    LINK:{
        address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
        symbol: "LINK",
    },
    wCRES:{
        address: "0xa0afAA285Ce85974c3C881256cB7F225e3A1178a",
        symbol: "wCRES",
    },
};

const DODOPools:DODOPoolType[] = [
    {
        address: "0x75c23271661d9d143dcb617222bc4bec783eff34",
        name: "WETH-USDC",
        tokens: ['WETH', 'USDC'],
    },
    {
        address: "0x562c0b218cc9ba06d9eb42f3aef54c54cc5a4650",
        name: "LINK-USDC",
        tokens: ['LINK', 'USDC'],
    },
    {
        address: "0xc226118fcd120634400ce228d61e1538fb21755f",
        name: "LEND-USDC",
        tokens: ['LEND', 'USDC'],
    },
    {
        address: "0x94512fd4fb4feb63a6c0f4bedecc4a00ee260528",
        name: "LINK-USDC",
        tokens: ['AAVE', 'USDC'],
    },
    {
        address: "0xca7b0632bd0e646b0f823927d3d2e61b00fe4d80",
        name: "SNX-USDC",
        tokens: ['SNX', 'USDC'],
    },
    {
       address: '0x0d04146b2fe5d267629a7eb341fb4388dcdbd22f',
        name: "COMP-USDC",
        tokens: ['COMP', 'USDC'],
    },
    {
        address: "0x2109f78b46a789125598f5ad2b7f243751c2934d",
        name: "WBTC-USDC",
        tokens: ['WBTC', 'USDC'],
    },
    {
        address: "0x1b7902a66f133d899130bf44d7d879da89913b2e",
        name: "YFI-USDC",
        tokens: ['YFI', 'USDC'],
    },
    {
        address: "0x9d9793e1e18cdee6cf63818315d55244f73ec006",
        name: 'FIN-USDT',
        tokens: ['FIN', 'USDT'],
    },
    {
        address: "0xC9f93163c99695c6526b799EbcA2207Fdf7D61aD",
        name: 'USDT-USDC',
        tokens: ['USDT', 'USDC'],
    },
    {
        address: '0x181d93ea28023bf40c8bb94796c55138719803b4',
        name: "WOO-USDT",
        tokens: ['WOO', 'USDT'],
    },
    {
        address: "0x85f9569b69083c3e6aeffd301bb2c65606b5d575",
        name: "wCRES-USDT",
        tokens: ['wCRES', 'USDT'],
    }
];


export class DODOPoolProvider implements IRawPoolProvider {
public async getPools(): Promise<RawPool[]> {
    const rawPools: RawPool[] = [];
    for(const pool of DODOPools){
        const tokens = pool.tokens.map(token=>{
            return DODOTokens[token];
        });
        rawPools.push({protocol: 'DODO', id: pool.address, tokens, reserve: 0});
    }
    return rawPools;
  }
};
