var express = require("express");
var router = express.Router();
var fs = require("fs");
var async = require("async");
var uuidv1 = require('uuid/v1');

var Util = require("../controller/util");
const conn = require("../config/connection");
const perQuery = require('../config/queries/permission')

router.get('/getPermission', (req, res, next) => {
    const uid = req.user.uid
    conn.getConnection((error, connection) => {
        if (error) return
        connection.query(perQuery.selectPermissionWithUid(uid), (err, rows) => {
            if (rows && rows.length) {
                Util.sendResult(res, 0, '查询成功', rows)
            } else {
                Util.sendResult(res, 1000, '服务器内部错误')
            }
            connection.release()
        })
    })
})

// router.get('/getPermissionWithJob', (req, res, next) => {
//     const job_id = req.query.job_id
//     const uid = req.user.uid
//     if (!job_id) {
//         Util.sendResult(res, 1003, '参数缺失')
//         return
//     }
//     conn.getConnection((error, connection) => {
//         if (error) return
//         connection.query()
//     })
// })

module.exports = router;
