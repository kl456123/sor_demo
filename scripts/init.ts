import { ethers } from 'ethers';


const provider = new ethers.providers.JsonRpcProvider('http://localhost:8547');


async function main(){
    const blockNumber = await provider.getBlockNumber();
    console.log(blockNumber);
    const account = "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8";
    await provider.send("hardhat_impersonateAccount", [account]);
    const signer = provider.getSigner(account);
    const before = await provider.getBalance(account);
    console.log(before.toString());
    await signer.sendTransaction({to: ethers.constants.AddressZero, value: before.div(10)});
}


main().catch(console.error);
