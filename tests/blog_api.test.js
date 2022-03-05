const mongoose = require('mongoose')
const supertest = require('supertest')
const app = require('../app')
const api = supertest(app)
const Blog = require('../models/blog')
const helper = require('./test_helper')

const mms = require('mongodb-memory-server')
var mongod

beforeAll(async () => {
  mongod = await mms.MongoMemoryServer.create()
  const mongooseOpts = { useNewUrlParser: true }
  await mongoose.connect(mongod.getUri(), mongooseOpts);
})

beforeEach(async () => {
  await Blog.deleteMany({})

  const blogObjects = helper.initialBlogs.map(blog => new Blog(blog))
  const promiseArray = blogObjects.map(blog => blog.save())
  await Promise.all(promiseArray)
})

test('notes are returned as json', async () => {
  await api
    .get('/api/blogs')
    .expect(200)
    .expect('content-type', /application\/json/)
})

test('all blogs are returned', async () => {
  const response = await api.get('/api/blogs')
  
  expect(response.body).toHaveLength(helper.initialBlogs.length)
})

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
})