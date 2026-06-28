import BaseRepository from './baseRepository';
import TransferRecord from '@/models/TransferRecord';

class TransferRepository extends BaseRepository {
  constructor() {
    super(TransferRecord);
  }

  async findByLinkId(linkId) {
    return await this.findOne({ linkId });
  }

  async findBySenderEmail(email, options = {}) {
    return await this.findMany({ senderEmail: email }, options);
  }
}

export const transferRepository = new TransferRepository();
