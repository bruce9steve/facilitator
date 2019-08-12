// Copyright 2019 OpenST Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// ----------------------------------------------------------------------------

import BigNumber from 'bignumber.js';

import Logger from '../Logger';
import StakeRequest from '../models/StakeRequest';
import StakeRequestRepository from '../repositories/StakeRequestRepository';
import ContractEntityHandler from './ContractEntityHandler';
import Utils from '../Utils';

/**
 * This class handles stake request transactions.
 */
export default class StakeRequestHandler extends ContractEntityHandler<StakeRequest> {
  /* Storage */

  private readonly stakeRequestRepository: StakeRequestRepository;

  public constructor(stakeRequestRepository: StakeRequestRepository) {
    super();

    this.stakeRequestRepository = stakeRequestRepository;
  }

  /**
   * This method parse stakeRequest transaction and returns stakeRequest model object.
   *
   * Note: In case of forking, stakeRequest transaction will be received multiple times.
   * Check if StakeRequest record is already present in database for that stakeRequestHash. If
   * it's present update messageHash to be NULL. This will make sure acceptStakeRequest transaction
   * is retried again.
   *
   * @param transactions Transaction objects.
   *
   * @return Array of instances of StakeRequest objects.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async persist(transactions: any[]): Promise<StakeRequest[]> {
    Logger.debug('Persisting stake request records');
    const models: StakeRequest[] = await Promise.all(transactions.map(
      async (transaction): Promise<StakeRequest> => {
        const { stakeRequestHash } = transaction;
        const amount = new BigNumber(transaction.amount);
        const beneficiary = Utils.toChecksumAddress(transaction.beneficiary);
        const gasPrice = new BigNumber(transaction.gasPrice);
        const gasLimit = new BigNumber(transaction.gasLimit);
        const nonce = new BigNumber(transaction.nonce);
        const gateway = Utils.toChecksumAddress(transaction.gateway);
        const staker = Utils.toChecksumAddress(transaction.staker);
        const stakerProxy = Utils.toChecksumAddress(transaction.stakerProxy);
        const blockNumber = new BigNumber(transaction.blockNumber);

        let stakeRequest = await this.stakeRequestRepository.get(stakeRequestHash);
        if (stakeRequest && blockNumber.gt(stakeRequest.blockNumber!)) {
          Logger.debug(`stakeRequest already present for hash ${stakeRequestHash}.`);
          stakeRequest.blockNumber = blockNumber;
          stakeRequest.messageHash = undefined;
          return stakeRequest;
        } else {
          return new StakeRequest(
            stakeRequestHash,
            amount,
            beneficiary,
            gasPrice,
            gasLimit,
            nonce,
            gateway,
            staker,
            stakerProxy,
            blockNumber,
          );
        }
      },
    ));

    const savePromises = [];
    for (let i = 0; i < models.length; i += 1) {
      Logger.debug(`Saving stake request for hash ${models[i].stakeRequestHash}`);
      savePromises.push(this.stakeRequestRepository.save(models[i]));
    }
    await Promise.all(savePromises);
    Logger.debug('Stake requests saved');

    return models;
  }
}
