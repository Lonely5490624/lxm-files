var express = require("express");
var router = express.Router();
var fs = require("fs");
var async = require("async");
var uuidv1 = require('uuid/v1');

var Util = require("../controller/util");
const conn = require("../config/connection");
const dirQuery = require('../config/queries/dir')
const fileQuery = require('../config/queries/file')
const perQuery = require('../config/queries/permission')

router.get('/getFileWithDirId', (req, res, next) => {
    const dir_id = req.query.dir_id
    const uid = req.user.uid
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let result_arr = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询目录下面的文件
                connection.query(fileQuery.selectFileWithDirId(dir_id), (err, rows) => {
                    if (rows && rows.length) {
                        result_arr = rows
                    }
                    callback(err)
                })
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
                    Util.sendResult(res, 0, '查询成功', result_arr)
                })
			}
            connection.release()
		});
	});
})

router.get('/getShareFileWithDirId', (req, res, next) => {
    const dir_id = req.query.dir_id
    const uid = req.user.uid
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let result_arr = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询目录下面的文件
                connection.query(`SELECT * FROM lxm_file_file WHERE is_share = 1 AND dir_id = ${dir_id} AND is_delete = 0`, (err, rows) => {
                    if (rows && rows.length) {
                        result_arr = rows
                    }
                    callback(err)
                })
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
                    Util.sendResult(res, 0, '查询成功', result_arr)
                })
			}
            connection.release()
		});
	});
})

router.get('/fileDownload', (req, res, next) => {
    const file_id = req.query.file_id
    const uid = req.user.uid
    if (!file_id) {
        Util.sendResult(res, 1000, '没有file_id')
        return
    }
    conn.getConnection((error, connection) => {
        if (error) return
        // 查询用户权限
        connection.query(perQuery.selectPermissionWithUid(uid), (err, rows) => {
            // if (rows && rows.length && rows[0].download_file) {
                // 下载文件
                connection.query(fileQuery.selectFileWithFileId(file_id), (err, rows) => {
                    if (err) return
                    res.download(rows[0].file_path)
                })
            // } else {
            //     Util.sendResult(res, 1004, '没有权限')
            // }
            connection.release()
        })
    })
})

router.post('/uploadFile', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    if (!req.files) {
        Util.sendResult(res, 1000, '请选择文件')
        return
    }
    let dir_id = body.dir_id
    if (!dir_id) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let dir_path = undefined
        let failFiles = []
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询该用户的权限
                connection.query(perQuery.selectPermissionWithUid(uid), (err, rows) => {
                    if (rows && rows.length && rows[0].upload_file) {
                    } else {
                        Util.sendResult(res, 1004, '没有权限')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询目录是否存在
                connection.query(dirQuery.selectDirWithId(dir_id), (err, rows) => {
                    if (rows && rows.length) {
                        dir_path = rows[0].dir_path
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 保存文件到服务器
                // const childTasks = Object.values(req.files).map((file, index) => {
                const childTasks = [req.files.file].map((file, index) => {
                    const show_name = file.name
                    const true_name = Date.parse(new Date()) + show_name
                    const path = `${dir_path}/${true_name}`
                    return function(cb) {
                        // 查询当前文件路径是否存在
                        connection.query(fileQuery.selectFileWithPath(path), (err, rows) => {
                            if (rows && rows.length) {
                                failFiles.push(show_name)
                                cb(null)
                            } else {
                                const values = {
                                    dir_id,
                                    file_name: show_name,
                                    file_path: path,
                                    type: 1,
                                    ext: Util.getFileExt(show_name),
                                    size: file.size,
                                    uniq: uuidv1(),
                                    create_uid: uid
                                }
                                // 保存文件到文件表
                                connection.query(fileQuery.addFile(values), err2 => {
                                    if (err2) {
                                        cb(err2)
                                    } else {
                                        file.mv(path)
                                        cb(null)
                                    }
                                })
                            }
                        })
                    }
                })
                async.series(childTasks, err => {
                    callback(err)
                })
            }
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '上传失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    if (failFiles.length) {
                        Util.sendResult(res, 0, '以下文件未上传成功', failFiles)
                    } else {
                        Util.sendResult(res, 0, '上传成功')
                    }
				});
			}
            connection.release()
		});
	});
})

router.post('/uploadCommonFile', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    if (!req.files) {
        Util.sendResult(res, 1000, '请选择文件')
        return
    }
    let dir_id = body.dir_id
    if (!dir_id) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let dir_path = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询目录是否存在
                connection.query(dirQuery.selectDirWithId(dir_id), (err, rows) => {
                    if (rows && rows.length) {
                        dir_path = rows[0].dir_path
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 保存文件到服务器
                // const childTasks = Object.values(req.files).map((file, index) => {
                const childTasks = [req.files.file].map((file, index) => {
                    const show_name = file.name
                    const path = `${dir_path}/${show_name}`
                    return function(cb) {
                        // 查询当前文件路径是否存在
                        connection.query(fileQuery.selectFileWithPath(path), (err, rows) => {
                            if (err) {
                                cb(err)
                                return
                            }
                            if (rows && rows.length) {
                                // 覆盖文件
                                connection.query(`UPDATE lxm_file_file SET
                                    dir_id=${dir_id},
                                    file_name='${show_name}',
                                    file_path='${path}',
                                    type=1,
                                    ext='${Util.getFileExt(show_name)}',
                                    size=${file.size},
                                    uniq='${uuidv1()}',
                                    create_uid='${uid}'
                                    WHERE file_path='${path}' AND is_delete=0
                                `, err2 => {
                                    cb(err2)
                                })
                            } else {
                                const values = {
                                    dir_id,
                                    file_name: show_name,
                                    file_path: path,
                                    type: 1,
                                    ext: Util.getFileExt(show_name),
                                    size: file.size,
                                    uniq: uuidv1(),
                                    create_uid: uid
                                }
                                // 保存文件到文件表
                                connection.query(fileQuery.addFile(values), err2 => {
                                    if (err2) {
                                        cb(err2)
                                    } else {
                                        file.mv(path)
                                        cb(null)
                                    }
                                })
                            }
                        })
                    }
                })
                async.series(childTasks, err => {
                    callback(err)
                })
            }
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '上传失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    Util.sendResult(res, 0, '上传成功')
				});
			}
            connection.release()
		});
	});
})

router.post('/updateFile', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    const {
        file_id,
        new_name
    } = body
    if (!file_id || !new_name) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let old_name = undefined
        let old_file_path = undefined
        let new_path = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询用户权限
                connection.query(perQuery.selectPermissionWithUid(uid), (err, rows) => {
                    if (rows && rows.length && rows[0].rename_file) {
                    } else {
                        Util.sendResult(res, 1004, '没有权限')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询当前文件是否存在
                connection.query(fileQuery.selectFileWithFileId(file_id), (err, rows) => {
                    if (rows && rows.length) {
                        old_name = rows[0].file_name
                        old_file_path = rows[0].file_path
                    } else {
                        Util.sendResult(res, 1000, '文件不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 修改文件名称
                new_path = old_file_path.replace(old_name, new_name)
                let new_ext = Util.getFileExt(new_name)
                connection.query(fileQuery.updateFileName(file_id, new_name, new_path, new_ext, uid), err => {
                    callback(err)
                })
            }
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '更新失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    fs.renameSync(old_file_path, new_path)
					Util.sendResult(res, 0, '更新成功')
				});
			}
            connection.release()
		});
	});
})

router.post('/modifyCommonFile', (req, res, next) => {
    const uid = req.user.uid
    const {
        file_id,
        new_name
    } = req.body
    if (!file_id || !new_name) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }

    conn.getConnection((error, connection) => {
        if (error) return;
        let dir_id = undefined
        let dir_path = undefined
        let old_file_path = undefined
        let file_path = undefined

        const tasks = [
            function(callback) {
                connection.query('BEGIN', err => {
                    callback(err)
                })
            },
            function(callback) {
                // 查询文件是否存在
                connection.query(`SELECT * FROM lxm_file_file WHERE file_id=${file_id} AND is_delete=0`, (err, rows) => {
                    if (err) callback(err)
                    else if (rows && rows.length) {
                        dir_id = rows[0].dir_id
                        old_file_path = rows[0].file_path
                        callback(null)
                    } else {
                        Util.sendResult(res, 1000, '文件不存在')
                        connection.release()
                        return
                    }
                })
            },
            function(callback) {
                // 获取文件所在的目录路径
                connection.query(`SELECT * FROM lxm_file_dir WHERE dir_id=${dir_id} AND is_delete=0`, (err, rows) => {
                    if (err) callback(err)
                    else if (rows && rows.length) {
                        dir_path = rows[0].dir_path
                        callback(null)
                    } else {
                        Util.sendResult(res, 1000, '文件所在目录不存在')
                        connection.release()
                        return
                    }
                })
            },
            function(callback) {
                // 修改文件名和文件路径
                file_path = `${dir_path}/${new_name}`
                connection.query(`UPDATE lxm_file_file SET file_name='${new_name}', file_path='${file_path}' WHERE file_id=${file_id} AND is_delete=0`, err => {
                    callback(err)
                })
            }
        ]
        async.waterfall(tasks, err => {
            if (err) {
                console.error(err)
                connection.query('ROLLBACK', () => {
                    Util.sendResult(res, 1000, '修改失败')
                })
            } else {
                connection.query('COMMIT', () => {
                    fs.renameSync(old_file_path, file_path)
                    Util.sendResult(res, 0, '修改成功')
                })
            }
            connection.release()
        })
    })
})

router.post('/deleteFile', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    const {
        file_id
    } = body
    if (!file_id) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let old_file_path = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 如果是普通用户不考虑权限
                connection.query(`SELECT * FROM lxm_user_common WHERE uid='${uid}' AND is_delete=0`, (err2, rows2) => {
                    if (err2) callback(err2)
                    if (rows2 && rows2.length) {
                        callback(null)
                    } else {
                        // 查询用户权限
                        connection.query(perQuery.selectPermissionWithUid(uid), (err, rows) => {
                            if (rows && rows.length && rows[0].delete_file) {
                            } else {
                                Util.sendResult(res, 1004, '没有权限')
                                connection.release()
                                return
                            }
                            callback(err)
                        })
                    }
                })
            },
            function(callback) {
                // 查询当前文件是否存在
                connection.query(fileQuery.selectFileWithFileId(file_id), (err, rows) => {
                    if (rows && rows.length) {
                        old_file_path = rows.file_path
                    } else {
                        Util.sendResult(res, 1000, '文件不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 删除文件
                connection.query(fileQuery.deleteFileWithFileId(file_id, uid), err => {
                    callback(err)
                })
            }
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '删除失败')
				});
			} else {
				connection.query('COMMIT', () => {
					Util.sendResult(res, 0, '删除成功')
				});
			}
            connection.release()
		});
	});
})

module.exports = router;
