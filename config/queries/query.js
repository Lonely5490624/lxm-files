const conn = require('../connection')

module.exports = function (sql, values) {
    return new Promise((resolve, reject) => {
        conn.query(sql, values, (err, rows) => {
            if (err) reject(err)
            else resolve(rows)
        })
    })
}