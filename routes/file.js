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
        let dir_pid = undefined
        let failFiles = []
        let dirUserId = undefined   // 目录所属的用户ID
        let space_all = undefined   // 目录所属用户的总空间
        let space_used = undefined  // 目录所属用户的已用空间
        
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
                        dir_pid = rows[0].dir_pid
                    }
                    callback(err)
                })
            },
            /**
             * 一层一层往上查询当前文件所属的用户
             * 有用户->则找到空间，并且添加已用空间
             * 没有用户->则递归查找上一级目录，直到目录的上级目录（dir_pid）为0，表示没有不属于用户空间
             */
            function(callback) {
                const findUserFromDir = function(dir_path, dir_pid) {
                    if (dir_pid === 0) callback(null)
                    else {
                        connection.query(`SELECT * FROM lxm_user_staff WHERE homefolder='${dir_path}'`, (err, rows) => {
                            if (rows) {
                                if (rows.length) {
                                    dirUserId = rows[0].uid
                                    space_all = rows[0].space_all
                                    space_used = rows[0].space_used
                                    callback(null)
                                } else {
                                    connection.query(`SELECT * FROM lxm_file_dir WHERE dir_id=${dir_pid}`, (err2, rows2) => {
                                        if (rows2 && rows2.length) {
                                            const dir_path2 = rows2[0].dir_path
                                            const dir_pid2 = rows2[0].dir_pid
                                            findUserFromDir(dir_path2, dir_pid2)
                                        } else {
                                            callback(err2)
                                        }
                                    })
                                }
                            } else {
                                callback(err)
                            }
                        })
                    }
                }
                findUserFromDir(dir_path, dir_pid)
            },
            function(callback) {
                // 验证用户的可用空间
                if (dirUserId) {
                    const space_unuse = space_all - space_used
                    const fileSize = req.files.file.size
                    if (fileSize > space_unuse) {
                        Util.sendResult(res, 1000, '空间不足')
                        connection.release()
                        return
                    } else {
                        connection.query(`UPDATE lxm_user_staff SET space_used=${space_used + fileSize} WHERE uid='${dirUserId}'`, err => {
                            callback(err)
                        })
                    }
                } else {
                    callback(null)
                }
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
        let dir_pid = undefined
        let dirUserId = undefined   // 目录所属的用户ID
        let space_all = undefined   // 目录所属用户的总空间
        let space_used = undefined  // 目录所属用户的已用空间
        
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
                        dir_pid = rows[0].dir_pid
                    }
                    callback(err)
                })
            },
            /**
             * 一层一层往上查询当前文件所属的用户
             * 有用户->则找到空间，并且添加已用空间
             * 没有用户->则递归查找上一级目录，直到目录的上级目录（dir_pid）为0，表示没有不属于用户空间
             */
            function(callback) {
                const findUserFromDir = function(dir_path, dir_pid) {
                    if (dir_pid === 0) callback(null)
                    else {
                        connection.query(`SELECT * FROM lxm_user_common WHERE homefolder='${dir_path}'`, (err, rows) => {
                            if (rows) {
                                if (rows.length) {
                                    dirUserId = rows[0].uid
                                    space_all = rows[0].space_all
                                    space_used = rows[0].space_used
                                    callback(null)
                                } else {
                                    connection.query(`SELECT * FROM lxm_file_dir WHERE dir_id=${dir_pid}`, (err2, rows2) => {
                                        if (rows2 && rows2.length) {
                                            const dir_path2 = rows2[0].dir_path
                                            const dir_pid2 = rows2[0].dir_pid
                                            findUserFromDir(dir_path2, dir_pid2)
                                        } else {
                                            callback(err2)
                                        }
                                    })
                                }
                            } else {
                                callback(err)
                            }
                        })
                    }
                }
                findUserFromDir(dir_path, dir_pid)
            },
            function(callback) {
                // 验证用户的可用空间
                if (dirUserId) {
                    const space_unuse = space_all - space_used
                    const fileSize = req.files.file.size
                    if (fileSize > space_unuse) {
                        Util.sendResult(res, 1000, '空间不足')
                        connection.release()
                        return
                    } else {
                        connection.query(`UPDATE lxm_user_common SET space_used=${space_used + fileSize} WHERE uid='${dirUserId}'`, err => {
                            callback(err)
                        })
                    }
                } else {
                    callback(null)
                }
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
        let dir_path = undefined
        let dir_pid = undefined
        let dirUserId = undefined   // 目录所属的用户ID
        let space_all = undefined   // 目录所属用户的总空间
        let space_used = undefined  // 目录所属用户的已用空间
        let isCommonUser = false
        
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
                        isCommonUser = true
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
                // 查找文件所在的目录，便于计算空间
                connection.query(`SELECT * FROM lxm_file_dir WHERE dir_id=(SELECT dir_id FROM lxm_file_file WHERE file_id=${file_id} AND is_delete=0)`, (err, rows) => {
                    if (rows && rows.length) {
                        dir_path = rows[0].dir_path
                        dir_pid = rows[0].dir_pid
                    }
                    callback(err)
                })
            },
            /**
             * 一层一层往上查询当前文件所属的用户
             * 有用户->则找到空间，并且添加已用空间
             * 没有用户->则递归查找上一级目录，直到目录的上级目录（dir_pid）为0，表示没有不属于用户空间
             */
            function(callback) {
                const findUserFromDir = function(dir_path, dir_pid) {
                    if (dir_pid === 0) callback(null)
                    else {
                        connection.query(`SELECT * FROM ${isCommonUser ? 'lxm_user_common' : 'lxm_user_staff'} WHERE homefolder='${dir_path}'`, (err, rows) => {
                            if (rows) {
                                if (rows.length) {
                                    dirUserId = rows[0].uid
                                    space_all = rows[0].space_all
                                    space_used = rows[0].space_used
                                    callback(null)
                                } else {
                                    connection.query(`SELECT * FROM lxm_file_dir WHERE dir_id=${dir_pid}`, (err2, rows2) => {
                                        if (rows2 && rows2.length) {
                                            const dir_path2 = rows2[0].dir_path
                                            const dir_pid2 = rows2[0].dir_pid
                                            findUserFromDir(dir_path2, dir_pid2)
                                        } else {
                                            callback(err2)
                                        }
                                    })
                                }
                            } else {
                                callback(err)
                            }
                        })
                    }
                }
                findUserFromDir(dir_path, dir_pid)
            },
            function(callback) {
                // 更新用户的可用空间
                if (dirUserId) {
                    // 查询当前文件的大小
                    connection.query(`SELECT * FROM lxm_file_file WHERE file_id=${file_id} AND is_delete=0`, (err, rows) => {
                        if (rows && rows.length) {
                            const size = rows[0].size
                            space_used = space_used - size
                            connection.query(`UPDATE ${isCommonUser ? 'lxm_user_common' : 'lxm_user_staff'} SET space_used=${space_used} WHERE uid='${dirUserId}'`, err2 => {
                                callback(err2)
                            })
                        } else {
                            callback(err)
                        }
                    })
                } else {
                    callback(null)
                }
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

// 获取作品文件
router.get('/getFileDetail', (req, res, next) => {
    const file_id = req.query.file_id
    if (!file_id) {
        Util.sendResult(res, 1000, '没有file_id')
        return
    }
    conn.getConnection((error, connection) => {
        if (error) return
        // 下载文件
        connection.query(fileQuery.selectFileWithFileId(file_id), (err, rows) => {
            if (err) return
            res.download(rows[0].file_path)
        })
        connection.release()
    })
})

module.exports = router;
