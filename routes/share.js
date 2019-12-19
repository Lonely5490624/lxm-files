var express = require("express");
var router = express.Router();
var fs = require("fs");
var async = require("async");
var uuidv1 = require('uuid/v1');

var Util = require("../controller/util");
const conn = require("../config/connection");
const userQuery = require('../config/queries/user')
const depQuery = require('../config/queries/department')
const jobQuery = require('../config/queries/job')
const dirQuery = require('../config/queries/dir')
const fileQuery = require('../config/queries/file')
const shareQuery = require('../config/queries/share')
const perQuery = require('../config/queries/permission')

router.get('/getShareDir', (req, res, next) => {
    const uid = req.user.uid

    conn.getConnection((error, connection) => {
        if (error) return;
        connection.query(`SELECT * FROM lxm_file_dir WHERE is_share = 1 AND is_delete = 0`, (err, rows) => {
            if (rows) {
                let data = Util.listToTree(rows, 'dir_id', 'dir_pid')
                Util.sendResult(res, 0, '查询成功', data || [])
                connection.release()
            }
        })
    })
})

router.post('/shareFile', (req, res, next) => {
    const uid = req.user.uid
    const body = req.body
    const {
        file_id
    } = body
    if (!file_id) {
        Util.sendResult(res, 1000, '请选择文件')
        return
    }
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let fileInfo = undefined
        let dirIdArr = []
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询该文件信息
                connection.query(`SELECT * FROM lxm_file_file WHERE file_id = ${file_id}`, (err, rows) =>{
                    if (rows && rows.length) {
                        fileInfo = rows[0]
                    } else {
                        Util.sendResult(res, 1000, '未找到该文件')
                        connection.release()
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 修改文件为共享文件
                connection.query(`UPDATE lxm_file_file SET is_share = 1, share_uid = '${uid}' WHERE file_id=${file_id}`, err => {
                    callback(err)
                })
            },
            function(callback) {
                // 查找该文件被包含的目录
                const findParDir = function(callback, dir_id) {
                    connection.query(`SELECT * FROM lxm_file_dir WHERE dir_id = ${dir_id}`, (err, rows) => {
                        if (rows && rows.length) {
                            dirIdArr.push(rows[0].dir_id)
                            if (rows[0].dir_pid !== 0) {
                                findParDir(callback, rows[0].dir_pid)
                            } else {
                                callback(err)
                            }
                        } else {
                            callback(err)
                        }
                    })
                }
                findParDir(callback, fileInfo.dir_id)
            },
            function(callback) {
                // 遍历所有目录，并将其改为isShare = 1
                const childTasks = dirIdArr.map(item => {
                    return function(cb) {
                        connection.query(`UPDATE lxm_file_dir SET is_share = 1  WHERE dir_id = ${item}`, err => {
                            cb(err)
                        })
                    }
                })
                async.waterfall(childTasks, err => {
                    callback(err)
                })
            }
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '共享失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    Util.sendResult(res, 0, '共享成功')
				});
			}
            connection.release()
		});
	});
})

router.post('/cancelShareFile', (req, res, next) => {
    const uid = req.user.uid
    const body = req.body
    const {
        file_id
    } = body
    if (!file_id) {
        Util.sendResult(res, 1000, '请选择文件')
        return
    }
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let dir_id = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询该用户是否有该文件的取消共享权限
                connection.query(`SELECT * FROM lxm_file_file WHERE file_id = ${file_id} AND share_uid = '${uid}' AND is_delete = 0`, (err, rows) => {
                    if (rows) {
                        if (rows.length) {
                            dir_id = rows[0].dir_id
                        } else {
                            Util.sendResult(res, 1004, '没有权限')
                            connection.release()
                            return
                        }
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 取消共享文件
                connection.query(`UPDATE lxm_file_file SET is_share = 0 WHERE file_id = '${file_id}'`, err => {
                    callback(err)
                })
            },
            function(callback) {
                /**
                 * 查询上级目录下的所有文件是否被还有文件被共享
                 * 若没有，则取消当前目录的共享，继续向上级找
                 * 若还有，则不取消当前目录的共享
                 */
                const cancelDirShare = function(cb, dir_id) {
                    connection.query(`SELECT * FROM lxm_file_file WHERE is_share = 1 AND dir_id = ${dir_id} AND is_delete = 0`, (err, rows) => {
                        connection.query(`SELECT * FROM lxm_file_dir WHERE is_share = 1 AND dir_pid = ${dir_id} AND is_delete = 0`, (err4, rows4) => {
                            if (rows) {
                                if (rows4) {
                                    if (rows.length || rows4.length) {
                                        // 若还有，则不取消当前目录的共享，直接进行下一步task
                                        cb(null)
                                    } else {
                                        // 若没有，则在目录表取消当前目录的共享，并递归查找更上一级
                                        connection.query(`UPDATE lxm_file_dir SET is_share = 0 WHERE dir_id = ${dir_id}`, err2 => {
                                            if(err2) cb(err2)
                                            else {
                                                connection.query(`SELECT * FROM lxm_file_dir WHERE dir_id = ${dir_id}`, (err3, rows2) => {
                                                    if (err3) cb(err2)
                                                    else if (rows2 && rows2.length && rows2[0].dir_id !== 0) {
                                                        cancelDirShare(cb, rows2[0].dir_pid)
                                                    } else {
                                                        cb(err3)
                                                    }
                                                })
                                            }
                                        })
                                    }
                                } else {
                                    cb(err4)
                                }
                            } else {
                                cb(err)
                            }
                        })
                    })
                }
                cancelDirShare(callback, dir_id)
            }
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '取消共享失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    Util.sendResult(res, 0, '取消共享成功')
				});
			}
            connection.release()
		});
	});
})

module.exports = router;
