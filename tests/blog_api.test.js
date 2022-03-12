const mongoose = require('mongoose')
const supertest = require('supertest')
const app = require('../app')
const api = supertest(app)
const bcrypt = require('bcrypt')
const Blog = require('../models/blog')
const User = require('../models/user')
const helper = require('./test_helper')

const mmm = require('mongodb-memory-server')
var mongod

beforeAll(async () => {
  mongod = await mmm.MongoMemoryServer.create()
  const mongooseOpts = { useNewUrlParser: true }
  await mongoose.connect(mongod.getUri(), mongooseOpts);
})

beforeEach(async () => {
  await Blog.deleteMany({})

  const blogObjects = helper.initialBlogs.map(blog => new Blog(blog))
  const promiseArray = blogObjects.map(blog => blog.save())
  await Promise.all(promiseArray)
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
  await mongod.stop()
})

describe('get blogs', () => {
  test('returned as json', async () => {
    await api
      .get('/api/blogs')
      .expect(200)
      .expect('content-type', /application\/json/)
  })

  test('all are returned', async () => {
    const response = await api.get('/api/blogs')
    expect(response.body).toHaveLength(helper.initialBlogs.length)
  })

  test('has field "id" and not "_id"', async () => {
    const response = await api.get('/api/blogs')
    expect(response.body[0]._id).toBeUndefined()
    expect(response.body[0].id).toBeDefined()
  })
})

describe('adding new blogs', () => {
  test('succeeds with valid data', async () => {
    const newBlog = {
      title: "Test Blog",
      author: "Tester McBloggerson",
      url: "www.iamatest.com",
      likes: 1,
    }

    await api
      .post('/api/blogs')
      .send(newBlog)
      .expect(201)
      .expect('content-type', /application\/json/)

    const blogsAtEnd = await helper.blogsInDb()
    expect(blogsAtEnd).toHaveLength(helper.initialBlogs.length + 1)

    const titles = blogsAtEnd.map(n => n.title)
    expect(titles).toContain('Test Blog')
  })

  test('fails with missing title or url data', async () => {
    const blogMissingTitle = {
      author: "Tester McBloggerson",
      url: "www.iamatest.com"
    }

    const blogMissingUrl = {
      title: "Test Blog",
      author: "Tester McBloggerson",
    }

    await api
      .post('/api/blogs')
      .send(blogMissingTitle)
      .expect(400)

    await api
      .post('/api/blogs')
      .send(blogMissingUrl)
      .expect(400)
  })

  test('omitted likes default to 0', async () => {
    const newBlog = {
      title: "Test Blog",
      author: "Tester McBloggerson",
      url: "www.iamatest.com"
    }

    await api
      .post('/api/blogs')
      .send(newBlog)
      .expect(201)
      .expect('content-type', /application\/json/)

    const testBlog = await Blog.findOne({title: "Test Blog"})
    expect(testBlog.likes).toBe(0)
  })
})

describe('deleting blogs', () => {
  test('succeeds with valid id', async () => {
    const blog = await Blog.findOne({})
    const id = blog.toJSON().id
    await api
      .delete(`/api/blogs/${id}`)
      .expect(204)
  })

  test('fails with non-existing id', async () => {
    const id = helper.nonExistingId()
    await api
      .delete(`/api/blogs/${id}`)
      .expect(400)
  })

  test('fails with malformatted id', async () => {
    const id = "invalid"
    await api
      .delete(`/api/blogs/${id}`)
      .expect(400)
  })
})

describe('updating blogs', () => {
  const updatedTitle = 'Updated Blog'
  const testPayload = { title: updatedTitle }
  
  test('succeeds with valid id', async () => {
    const anyBlog = await Blog.findOne({})
    const original = anyBlog.toJSON()
    
    const updatedBlog = {
      id: original.id,
      author: original.author,
      title: updatedTitle,
      url: original.url,
      likes: original.likes
    }

    await api
      .put(`/api/blogs/${original.id}`)
      .send(testPayload)
      .expect(200)
      .expect('content-type', /application\/json/)

    const foundUpdatedBlog = await Blog.findById(original.id)
    expect(foundUpdatedBlog.toJSON()).toEqual(updatedBlog)
  })

  test('fails with non-existing id', async () => {
    const id = helper.nonExistingId()
    await api
      .put(`/api/blogs/${id}`)
      .send(testPayload)
      .expect(400)
  })

  test('fails with malformatted id', async () => {
    const id = 'invalid'
    await api
      .put(`/api/blogs/${id}`)
      .send(testPayload)
      .expect(400)
  })
})

describe('when there is initially one user in db', () => {
  beforeEach(async () => {
    await User.deleteMany({})

    const passwordHash = await bcrypt.hash('sekret', 10)
    const user = new User({ username: 'root', passwordHash })

    await user.save()
  })

  test('creation succeeds with a fresh username', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'mluukkai',
      name: 'Matti Luukkainen',
      password: 'salainen',
    }

    await api
      .post('/api/users')
      .send(newUser)
      .expect(201)
      .expect('Content-Type', /application\/json/)

    const usersAtEnd = await helper.usersInDb()
    expect(usersAtEnd).toHaveLength(usersAtStart.length + 1)

    const usernames = usersAtEnd.map(u => u.username)
    expect(usernames).toContain(newUser.username)
  })

  test('creation fails with proper statuscode and message if username already taken', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'root',
      name: 'Superuser',
      password: 'salainen',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    expect(result.body.error).toContain('username must be unique')

    const usersAtEnd = await helper.usersInDb()
    expect(usersAtEnd).toEqual(usersAtStart)
  })
})