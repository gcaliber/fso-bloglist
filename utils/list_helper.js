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
  const result = ld.maxBy(Object.entries(ld.countBy(blogs, blog => blog.author)), author => author[1])
  return { author: result[0], blogs: result[1] }
}

const mostLikes = (blogs) => {
  const authors = ld.uniq(blogs.map(blog => blog.author))
  const likes = ld.map(authors, author =>
    ld.sumBy(blogs, blog => 
      blog.author === author ? blog.likes : 0
    )
  )
  const i = ld.findKey(likes, n => n === ld.max(likes))
  return { author: authors[i], likes: likes[i] }
}


module.exports = {
  dummy,
  totalLikes,
  favoriteBlog,
  mostBlogs,
  mostLikes
}