var express = require("express");
var router = express.Router();
var async = require("async");

const conn = require("../config/connection");

router.post('/collectFile', (req, res, next) => {
    const uid = req.user.uid
    const {
        file_id
    } = req.body
    if (!file_id) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }

    conn.getConnection((error, connection) => {
        if (error) return;

        const tasks = [
            function(callback) {
                connection.query('BEGIN', err => {
                    callback(err)
                })
            }
        ]
        async.waterfall(tasks, err => {
            if (err) {
                console.error(err)
                connection.query('ROLLBACK', () => {
                    Util.sendResult(res, 1000, '失败')
                })
            } else {
                connection.query('COMMIT', () => {
                    Util.sendResult(res, 0, '成功')
                })
            }
            connection.release()
        })
    })
})

module.exports = router;
