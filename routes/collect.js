var express = require("express");
var router = express.Router();
var async = require("async");

var Util = require("../controller/util");
const conn = require("../config/connection");


router.get('/getCollectList', (req, res, next) => {
    const uid = req.user.uid

    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let collectIds = undefined
        let collectList = []
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询用户的收藏列表
                connection.query(`SELECT * FROM lxm_user_staff WHERE uid='${uid}'`, (err, rows) => {
                    if (rows && rows.length) {
                        if (rows[0].collect_files && rows[0].collect_files.length) {
                            collectIds = rows[0].collect_files.split(',')
                        }
                    }
                    callback(err)
                })
            },
            function(callback) {
                if (collectIds && collectIds.length) {
                    // 遍历查找收藏文件的信息
                    const childTasks = collectIds.map(item => (
                        function(cb) {
                            connection.query(`SELECT * FROM lxm_file_file WHERE file_id=${item}`, (err, rows) => {
                                if (rows && rows.length) {
                                    delete rows[0].file_path
                                    collectList.push(rows[0])
                                }
                                cb(err)
                            })
                        }
                    ))
                    async.waterfall(childTasks, err => {
                        callback(err)
                    })
                } else {
                    callback(null)
                }
            }
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '查询失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    Util.sendResult(res, 0, '查询成功', collectList)
				});
			}
            connection.release()
		});
	});
})

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
        let collectList = []

        const tasks = [
            function(callback) {
                connection.query('BEGIN', err => {
                    callback(err)
                })
            },
            function(callback) {
                // 查询文件是否存在
                connection.query(`SELECT * FROM lxm_file_file WHERE file_id=${file_id}`, (err, rows) => {
                    if (rows && rows.length) {
                    } else {
                        Util.sendResult(res, 1000, '文件不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询用户已收藏的文件列表
                connection.query(`SELECT * FROM lxm_user_staff WHERE uid = '${uid}'`, (err, rows) => {
                    if (rows && rows.length) {
                        if (rows[0].collect_files && rows[0].collect_files.length) {
                            collectList = rows[0].collect_files.split(',')
                        }
                    }
                    callback(err)
                })
            },
            function(callback) {
                /**
                 * 查询当前文件是否已被收藏
                 * 若未被收藏，则拼装新的收藏列表并更新到用户表中
                 */
                if (collectList.includes(file_id)) {
                    Util.sendResult(res, 1000, '该文件已收藏')
                    connection.release()
                    return
                } else {
                    collectList.push(file_id)
                    connection.query(`UPDATE lxm_user_staff SET collect_files='${collectList.join()}' WHERE uid='${uid}'`, err => {
                        callback(err)
                    })
                }
            }
        ]
        async.waterfall(tasks, err => {
            if (err) {
                console.error(err)
                connection.query('ROLLBACK', () => {
                    Util.sendResult(res, 1000, '收藏失败')
                })
            } else {
                connection.query('COMMIT', () => {
                    Util.sendResult(res, 0, '收藏成功')
                })
            }
            connection.release()
        })
    })
})

router.post('/cancelCollect', (req, res, next) => {
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
        collectList = undefined

        const tasks = [
            function(callback) {
                connection.query('BEGIN', err => {
                    callback(err)
                })
            },
            function(callback) {
                // 查询文件是否存在
                connection.query(`SELECT * FROM lxm_file_file WHERE file_id=${file_id}`, (err, rows) => {
                    if (rows && rows.length) {
                    } else {
                        Util.sendResult(res, 1000, '文件不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 取出用户的收藏文件列表
                connection.query(`SELECT * FROM lxm_user_staff WHERE uid='${uid}'`, (err, rows) => {
                    if (rows && rows.length) {
                        if (rows[0].collect_files && rows[0].collect_files.length) {
                            collectList = rows[0].collect_files.split(',')
                        }
                    }
                    callback(err)
                })
            },
            function(callback) {
                /**
                 * 查询文件是否在收藏列表里面
                 * 若不在则返回错误
                 * 若在则删除再更新到用户表中
                 */
                if (collectList && collectList.includes(file_id)) {
                    const newList = collectList.filter(item => item !== file_id)
                    connection.query(`UPDATE lxm_user_staff SET collect_files=${newList} WHERE uid='${uid}'`, err => {
                        callback(err)
                    })
                } else {
                    Util.sendResult(res, 1000, '该文件未被收藏')
                    connection.release()
                    return
                }
            }
        ]
        async.waterfall(tasks, err => {
            if (err) {
                console.error(err)
                connection.query('ROLLBACK', () => {
                    Util.sendResult(res, 1000, '取消收藏失败')
                })
            } else {
                connection.query('COMMIT', () => {
                    Util.sendResult(res, 0, '取消收藏成功')
                })
            }
            connection.release()
        })
    })
})

module.exports = router;
