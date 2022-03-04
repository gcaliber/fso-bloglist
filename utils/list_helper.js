const blog = require("../models/blog")
const ld = require('lodash')

const dummy = (blogs) => {
  return 1
}

const totalLikes = (blogs) => {
  return blogs.reduce((total, blog) => total + blog.likes, 0)
}

const favoriteBlog = (blogs) => {
  let fav = blogs.slice(1)
    .reduce((fav, blog) => fav.likes > blog.likes ? fav : blog, blogs[0])

  return {
    title: fav.title,
    author: fav.author,
    likes: fav.likes
  }
}

const mostBlogs = (blogs) => {
  return ld.maxBy(Object.entries(ld.countBy(blogs, blog => blog.author)), item => item[1])
}

module.exports = {
  dummy,
  totalLikes,
  favoriteBlog,
  mostBlogs
}