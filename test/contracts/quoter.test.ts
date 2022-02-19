import { ethers } from 'hardhat';

import { Quoter } from '../../typechain-types/Quoter';
import { Quoter__factory } from '../../typechain-types/factories/Quoter__factory';

describe('Quoter', function () {
  let quoter: Quoter;
  beforeAll(async () => {
    const signer = await ethers.getSigners();
    const QuoterFactory = new Quoter__factory(signer[0]);
    quoter = await QuoterFactory.deploy();
  });

  it('Test MultiplexMultiHopSell', async () => {
    quoter.batchCall;
    expect;
  });

  it('Test MultiplexBatchSell', async () => {
    quoter.batchCall;
    expect;
  });
});
