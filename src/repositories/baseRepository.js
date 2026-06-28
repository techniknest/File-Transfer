class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id) {
    return await this.model.findById(id);
  }

  async findOne(query) {
    return await this.model.findOne(query);
  }

  async findMany(query, options = {}) {
    let cursor = this.model.find(query);
    if (options.sort) cursor = cursor.sort(options.sort);
    if (options.skip) cursor = cursor.skip(options.skip);
    if (options.limit) cursor = cursor.limit(options.limit);
    return await cursor.exec();
  }

  async create(data) {
    const document = new this.model(data);
    return await document.save();
  }

  async update(id, updateData) {
    return await this.model.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id) {
    return await this.model.findByIdAndDelete(id);
  }
}

export default BaseRepository;
