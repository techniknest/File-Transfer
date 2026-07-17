import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db.json');

const MockUser = {
  readDB() {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }));
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  },
  writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  },
  async findOne(query) {
    const db = this.readDB();
    if (query.email) return db.users.find(u => u.email === query.email) || null;
    if (query._id) return db.users.find(u => u._id === query._id) || null;
    return null;
  },
  async find() {
    const db = this.readDB();
    return db.users;
  },
  async countDocuments() {
    const db = this.readDB();
    return db.users.length;
  },
  async create({ name, email, password, role, status }) {
    const db = this.readDB();
    const user = {
      _id: Date.now().toString(),
      name, email, password,
      role: role || 'user',
      status: status || 'active',
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    this.writeDB(db);
    return user;
  },
  async findByIdAndUpdate(id, update) {
    const db = this.readDB();
    const idx = db.users.findIndex(u => u._id === id);
    if (idx === -1) return null;
    db.users[idx] = { ...db.users[idx], ...update.$set };
    this.writeDB(db);
    return db.users[idx];
  }
};

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  status: { type: String, default: 'active' },
  blockedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const MongoUser = mongoose.models.User || mongoose.model('User', UserSchema);

const User = new Proxy({}, {
  get(_, prop) {
    if (global.useMockDb) return MockUser[prop]?.bind(MockUser);
    return MongoUser[prop];
  }
});

export default User;