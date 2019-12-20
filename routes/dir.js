var express = require("express");
var router = express.Router();
var fs = require("fs");
var async = require("async");
var uuidv1 = require('uuid/v1');

var Util = require("../controller/util");
const conn = require("../config/connection");
const userQuery = require('../config/queries/user')
const dirQuery = require('../config/queries/dir')
const fileQuery = require('../config/queries/file')
const perQuery = require('../config/queries/permission')
const jobQuery = require('../config/queries/job')
const depQuery = require('../config/queries/department')

router.get('/getDirList', (req, res, next) => {
    const uid = req.user.uid
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let job_id = undefined
        let dep_id = undefined
        let is_manager = undefined
        let homefolder = undefined
        let dir_arr = undefined
        let exceptId = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询当前用户的岗位，是否为管理岗
                connection.query(userQuery.selectUserStaffWithUserId(uid), (err, rows) => {
                    if (rows && rows.length) {
                        job_id = rows[0].job_id
                        dep_id = rows[0].dep_id
                        connection.query(jobQuery.selectJobWithId(job_id), (err2, rows2) => {
                            if (rows2 && rows2.length) {
                                is_manager = rows2[0].is_manager
                            }
                            callback(err2)
                        })
                    } else callback(err)
                })
            },
            function(callback) {
                /**
                 * 若为管理者，则查询当前部门下所有目录
                 * 若不为管理者，则只查询当前用户下的所有目录
                 */
                if (is_manager) {
                    connection.query(depQuery.selectDepWithId(dep_id), (err, rows) => {
                        if (rows && rows.length) {
                            homefolder = rows[0].dep_dir
                        }
                        callback(err)
                    })
                } else {
                    // 查询用户的目录
                    connection.query(userQuery.selectUserStaffWithUserId(uid), (err, rows) => {
                        if (rows && rows.length) {
                            homefolder = rows[0].homefolder
                        }
                        callback(err)
                    })
                }
            },
            function(callback) {
                // 通过用户目录查询所有目录
                connection.query(dirQuery.selectDirLikePath(homefolder), (err, rows) => {
                    if (rows && rows.length) {
                        dir_arr = rows
                        let exceptItem = rows.find(item => item.dir_path === homefolder)
                        if (exceptItem) {
                            exceptId = exceptItem.dir_id
                        }
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
                    let result_arr = []
                    dir_arr.map(item => {
                        let obj = {
                            dir_id: item.dir_id,
                            dir_pid: item.dir_pid,
                            dir_name: item.dir_name,
                            can_delete: item.can_delete
                        }
                        result_arr.push(obj)
                    })
                    let data = Util.listToTree(result_arr, 'dir_id', 'dir_pid', exceptId)
					Util.sendResult(res, 0, '查询成功', data)
				});
            }
            connection.release()
		});
	});
})

router.get('/getDirWithDirPid', (req, res, next) => {
    const dir_pid = req.query.dir_pid
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
                // 查询目录下面的目录
                connection.query(dirQuery.selectDirWithPid(dir_pid), (err, rows) => {
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

router.post('/addDir', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        const show_name = body.dir_name
        const true_name = Date.parse(new Date()) + show_name
        let show_path = undefined

        let dir_pid = body.dir_pid
        let path = undefined
        let is_share = 0
        
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
                    if (rows && rows.length && rows[0].create_dir) {
                    } else {
                        Util.sendResult(res, 1004, '没有权限')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询上级目录是否存在
                connection.query(dirQuery.selectDirWithId(dir_pid), (err, rows) => {
                    if (rows && rows.length) {
                        path = `${rows[0].dir_path}/${true_name}`
                        show_path = `${rows[0].dir_name}/${show_name}`
                        is_share = rows[0].is_share // 若上级目录为分享目录，则下面也为分享目录
                    } else {
                        Util.sendResult(res, 1000, '上级目录不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询当前目录名称是否存在
                connection.query(dirQuery.selectDirWithName(show_name), (err, rows) => {
                    if (rows && rows.length) {
                        Util.sendResult(res, 1000, '已存在当前目录名称')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 新建目录表数据
                const values = {
                    dir_pid,
                    dir_name: show_path,
                    path,
                    can_delete: 1,
                    uniq: uuidv1(),
                    create_uid: uid
                }
                let addDir = null
                addDir = dirQuery.addDir
                connection.query(addDir(values), err => {
                    callback(err)
                })
            }
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '添加失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    // 新建文件夹
					Util.createStaffDir(path)
					Util.sendResult(res, 0, '添加成功')
				});
			}
            connection.release()
		});
	});
})

router.post('/renameDir', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        const show_name = body.new_name
        const true_name = Date.parse(new Date()) + show_name

        let dir_id = body.dir_id
        let old_name = undefined
        let path = undefined
        let new_path = undefined
        let sub_path = undefined
        let file_arr = undefined
        
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
                    if (rows && rows.length && rows[0].rename_dir) {
                    } else {
                        Util.sendResult(res, 1000, '没有权限')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询当前目录是否存在
                connection.query(dirQuery.selectDirWithId(dir_id), (err, rows) => {
                    if (rows && rows.length) {
                        path = rows[0].dir_path
                        const pathArr = path.split('/')
                        pathArr[pathArr.length - 1] = true_name
                        new_path = pathArr.join('/')
                        old_name = rows[0].dir_name
                    } else {
                        Util.sendResult(res, 1000, '当前目录不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
			function(callback) {
				// 查询当前目录的下级目录(目录表，除开当前目录)
				connection.query(dirQuery.selectDirLikePathWithoutSelf(path), (err, rows) => {
					if (rows && rows.length) {
						sub_path = rows
					}
					callback(err)
				})
            },
            function(callback) {
                // 修改下级目录的目录路径
                if (sub_path && sub_path.length) {
                    const childTasks = sub_path.map(item => {
                        const new_item_path = item.dir_path.replace(path, new_path)
                        return function(callback) {
                            connection.query(dirQuery.updateDirPathWithPath(item.dir_path, new_item_path, uid), err => {
                                callback(err)
                            })
                        }
                    })
                    async.series(childTasks, err => {
                        callback(err)
                    })
                } else {
                    callback(null)
                }
            },
			function(callback) {
				// 查询当前目录的文件（文件表）
				connection.query(fileQuery.selectFileLikePath(path), (err, rows) => {
					if (rows && rows.length) {
						file_arr = rows
					}
					callback(err)
				})
            },
            function(callback) {
                // 修改目录下面的文件路径
                if (file_arr && file_arr.length) {
                    const childTasks = file_arr.map(item => {
                        const new_item_path = item.file_path.replace(old_name, true_name)
                        return function(callback) {
                            connection.query(fileQuery.updateFilePath(item.file_path, new_item_path, uid), err => {
                                callback(err)
                            })
                        }
                    })
                    async.series(childTasks, err => {
                        callback(err)
                    })
                } else {
                    callback(null)
                }
            },
            function(callback) {
                // 重命名目录
                connection.query(dirQuery.updateDirNameWithPath(path, show_name, new_path, uid), err => {
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
                    // 重命名文件夹
					fs.renameSync(path, new_path)
					Util.sendResult(res, 0, '更新成功')
				});
			}
            connection.release()
		});
	});
})

router.post('/deleteDir', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        const {
            dir_id
        } = body
        let dir_arr = undefined
        let file_arr = undefined
        let old_dir_path = undefined
        
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
                    if (rows && rows.length && rows[0].delete_dir) {
                    } else {
                        Util.sendResult(res, 1004, '没有权限')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询当前目录是否存在
                connection.query(dirQuery.selectDirWithId(dir_id), (err, rows) => {
                    if (rows && rows.length) {
                        old_dir_path = rows[0].dir_path
                    } else {
                        Util.sendResult(res, 1000, '目录不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询当前目录下的所有目录(含自己)
                connection.query(dirQuery.selectDirLikePath(old_dir_path), (err, rows) => {
                    if (rows && rows.length) {
                        dir_arr = rows
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询当前目录下的所有文件
                connection.query(fileQuery.selectFileLikePath(old_dir_path), (err, rows) => {
                    if (rows && rows.length) {
                        file_arr = rows
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 删除目录下所有文件
                if (file_arr && file_arr.length) {
                    let childTasks = file_arr.map(item => {
                        return function(cb) {
                            connection.query(fileQuery.deleteFileWithFileId(item.file_id, uid), err => {
                                cb(err)
                            })
                        }
                    })
                    async.series(childTasks, err => {
                        callback(err)
                    })
                } else {
                    callback(null)
                }
            },
            function(callback) {
                // 删除所有目录（含自己）
                if (dir_arr && dir_arr.length) {
                    let childTasks = dir_arr.map(item => {
                        return function(cb) {
                            connection.query(dirQuery.deleteDirWithId(item.dir_id, uid), err => {
                                cb(err)
                            })
                        }
                    })
                    async.series(childTasks, err => {
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
