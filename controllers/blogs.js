const jwt = require('jsonwebtoken')
const blogsRouter = require('express').Router()
const Blog = require('../models/blog')
const User = require('../models/user')

const userExtractor = require('../utils/middleware').userExtractor

blogsRouter.get('/', async (request, response) => {
  const blogs = await Blog.find({})
    .populate('user', {name: 1})
  response.json(blogs)
})

blogsRouter.post('/', userExtractor, async (request, response) => {
  const body = request.body
  const user = request.user
  if (!request.user) {
    return response.status(401).json({ error: 'token missing or invalid' })
  }
  
  const blog = new Blog({
    title: body.title,
    author: body.author,
    url: body.url,
    likes: body.likes,
    user: user._id
  })
  const savedBlog = await blog.save()
  savedBlog.populate('user', {name: 1})

  user.blogs = user.blogs.concat(savedBlog._id)
  await user.save()

  response.status(201).json(savedBlog)
})

blogsRouter.delete('/:id', userExtractor, async (request, response) => {
  const user = await request.user
  if (!request.user) {
    return response.status(401).json({ error: 'token missing or invalid' })
  }

  const blog = await Blog.findById(request.params.id)

  if (blog.user.toString() === user._id.toString()) {
    await blog.deleteOne()
  }
  else {
    return response.status(401).json({ error: 'only the blog\'s creator may delete it' })
  }
  response.status(204).end()
})

blogsRouter.put('/:id', async (request, response) => {
  updatedBlog = await Blog.findByIdAndUpdate(
    request.params.id, 
    request.body, 
    {returnDocument: 'after'}
  ).populate('user', {name: 1})
  response.json(updatedBlog)
})

module.exports = blogsRouter
