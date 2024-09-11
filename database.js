// new MongoClient~~~를 변수에 저장하고 exports해주면 됨

const { MongoClient } = require('mongodb')
const url = process.env.DB_URL
let connectDB = new MongoClient(url).connect()

module.exports = connectDB