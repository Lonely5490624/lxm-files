const config = require('./db')
const mysql = require('mysql')

// const conn = mysql.createConnection(config.mysql)
const conn = mysql.createPool(config.mysql)

// conn.connect()

module.exports = conn