const mongoose = require('mongoose')
const supertest = require('supertest')
const jwt = require('jsonwebtoken')
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
  await User.deleteMany({})

  const initialUsersHashed = await Promise
    .all(helper.initialUsers.map(async (user) => {
      return {
        username: user.username,
        name: user.name,
        passwordHash: await bcrypt.hash(user.password, 10)
      }
  }))

  const userObjects = initialUsersHashed.map(user => new User(user))

  const userPromises = userObjects.map(user => user.save())
  await Promise.all(userPromises)

  const user0 = await User.findOne({ username: helper.initialUsers[0].username })

  const blogObjects = helper.initialBlogs.map(blog => {
    return new Blog({
      author: blog.author,
      title: blog.title,
      url: blog.url,
      likes: blog.likes,
      user: user0._id
    })
  })

  const blogPromises = blogObjects.map(blog => blog.save())
  await Promise.all(blogPromises)
  
  const allBlogs = await Blog.find({})
  user0.blogs = allBlogs.map(blog => blog._id)
  await user0.save()
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
  var token
  beforeEach(async () => {
    const user = await User.findOne({ username: helper.initialUsers[0].username })
    const userForToken = {
      username: user.username,
      id: user._id,
    }

    token = jwt.sign(userForToken, process.env.SECRET)
  })

  test('succeeds with valid data', async () => {
    const newBlog = {
      title: "Test Blog",
      author: "Tester McBloggerson",
      url: "www.iamatest.com",
      likes: 1,
    }

    await api
      .post('/api/blogs')
      .set('Authorization', `bearer ${token}`)
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
      .set('Authorization', `bearer ${token}`)
      .send(blogMissingTitle)
      .expect(400)

    await api
      .post('/api/blogs')
      .set('Authorization', `bearer ${token}`)
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
      .set('Authorization', `bearer ${token}`)
      .send(newBlog)
      .expect(201)
      .expect('content-type', /application\/json/)

    const testBlog = await Blog.findOne({title: "Test Blog"})
    expect(testBlog.likes).toBe(0)
  })

  test('fails if no token is provided', async () => {
    const newBlog = {
      title: "Test Blog",
      author: "Tester McBloggerson",
      url: "www.iamatest.com"
    }

    await api
      .post('/api/blogs')
      .send(newBlog)
      .expect(401)
      .expect('content-type', /application\/json/)
  })
})

describe('deleting blogs', () => {
  var token
  beforeEach(async () => {
    const user = await User.findOne({ username: helper.initialUsers[0].username })
    const userForToken = {
      username: user.username,
      id: user._id,
    }

    token = jwt.sign(userForToken, process.env.SECRET)
  })

  test('succeeds with valid id', async () => {
    const blog = await Blog.findOne({})
    const id = blog.toJSON().id
    await api
      .delete(`/api/blogs/${id}`)
      .set('Authorization', `bearer ${token}`)
      .expect(204)
  })

  test('fails with non-existing id', async () => {
    const id = helper.nonExistingId()
    await api
      .delete(`/api/blogs/${id}`)
      .set('Authorization', `bearer ${token}`)
      .expect(400)
  })

  test('fails with malformatted id', async () => {
    const id = "invalid"
    await api
      .delete(`/api/blogs/${id}`)
      .set('Authorization', `bearer ${token}`)
      .expect(400)
  })

  test('fails if no token is provided', async () => {
    const newBlog = {
      title: "Test Blog",
      author: "Tester McBloggerson",
      url: "www.iamatest.com"
    }

    await api
      .post('/api/blogs')
      .send(newBlog)
      .expect(401)
      .expect('content-type', /application\/json/)
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
      likes: original.likes,
      user: original.user
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