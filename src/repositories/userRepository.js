import BaseRepository from './baseRepository';
import User from '@/models/User';

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  // Add any user-specific database operations here
  async findByEmail(email) {
    return await this.findOne({ email });
  }
}

export const userRepository = new UserRepository();
