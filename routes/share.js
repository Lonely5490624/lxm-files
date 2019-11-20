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

    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let dep_id = undefined
        let job_id = undefined
        let dir_id_arr = []
        let dir_arr = []
        let result_arr = []
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询该用户的部门、岗位ID
                connection.query(userQuery.selectUserStaffWithUserId(uid), (err, rows) => {
                    if (rows && rows.length) {
                        dep_id = rows[0].dep_id
                        job_id = rows[0].job_id
                    } else {
                        Util.sendResult(res, 1000, '当前用户不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询该用户的部门被共享的目录
                connection.query(shareQuery.selectShareDirWithDep(dep_id), (err, rows) => {
                    if (rows && rows.length) {
                        dir_id_arr.push(...rows)
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询该用户的岗位被共享的目录
                connection.query(shareQuery.selectShareDirWithJob(job_id), (err, rows) => {
                    if (rows && rows.length) {
                        dir_id_arr.push(...rows)
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询该用户被共享的目录
                connection.query(shareQuery.selectShareDirWithUser(uid), (err, rows) => {
                    if (rows && rows.length) {
                        dir_id_arr.push(...rows)
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 通过被共享的目录id，查找出其他目录信息
                if (dir_id_arr && dir_id_arr.length) {
                    let reduced_arr = Util.reduceJsonArray(dir_id_arr, 'dir_id')
                    let childTasks = reduced_arr.map(item => {
                        return function(cb) {
                            connection.query(dirQuery.selectDirWithId(item.dir_id), (err, rows) => {
                                if (rows && rows.length) {
                                    let data = rows[0]
                                    data.perms_upload = item.perms_upload
                                    data.perms_download = item.perms_download
                                    data.perms_update = item.perms_update
                                    data.perms_delete = item.perms_delete
                                    dir_arr.push(data)
                                }
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
                // 查询被共享目录下的所有目录
                if (dir_arr.length) {
                    let childTasks = dir_arr.map(item => {
                        let path = item.dir_path
                        return function(cb) {
                            connection.query(dirQuery.selectDirLikePath(path), (err, rows) => {
                                result_arr.push(...rows)
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
					Util.sendResult(res, 1000, '查询失败')
				});
			} else {
				connection.query('COMMIT', () => {
					Util.sendResult(res, 0, '查询成功', Util.listToTree(result_arr, 'dir_id', 'dir_pid'))
				});
			}
            connection.release()
		});
	});
})

router.get('/getShareFile', (req, res, next) => {
    const uid = req.user.uid

    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let dep_id = undefined
        let job_id = undefined
        let dir_id_arr = []
        let file_arr = []
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询该用户的部门、岗位ID
                connection.query(userQuery.selectUserStaffWithUserId(uid), (err, rows) => {
                    if (rows && rows.length) {
                        dep_id = rows[0].dep_id
                        job_id = rows[0].job_id
                    } else {
                        Util.sendResult(res, 1000, '当前用户不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询该用户的部门被共享的文件
                connection.query(shareQuery.selectShareDirWithDep(dep_id), (err, rows) => {
                    if (rows && rows.length) {
                        dir_id_arr.push(...rows)
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询该用户的岗位被共享的文件
                connection.query(shareQuery.selectShareDirWithJob(job_id), (err, rows) => {
                    if (rows && rows.length) {
                        dir_id_arr.push(...rows)
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询该用户被共享的文件
                connection.query(shareQuery.selectShareDirWithUser(uid), (err, rows) => {
                    if (rows && rows.length) {
                        dir_id_arr.push(...rows)
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 通过被共享的文件id，查找出其他文件信息
                let reduced_arr = Util.reduceJsonArray(dir_id_arr, 'file_id')
                let childTasks = reduced_arr.map(item => {
                    return function(cb) {
                        connection.query(fileQuery.selectFileWithFileId(item.file_id), (err, rows) => {
                            if (rows && rows.length) {
                                let data = rows[0]
                                data.perms_upload = item.perms_upload
                                data.perms_download = item.perms_download
                                data.perms_update = item.perms_update
                                data.perms_delete = item.perms_delete
                                file_arr.push(data)
                            }
                            cb(err)
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
					Util.sendResult(res, 1000, '查询失败')
				});
			} else {
				connection.query('COMMIT', () => {
					Util.sendResult(res, 0, '查询成功', file_arr)
				});
			}
            connection.release()
		});
	});
})

router.get('/getShareDirFromMe', (req, res, next) => {
    const uid = req.user.uid

    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let dir_id_arr = undefined
        let dir_arr = []
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询我共享的目录
                connection.query(shareQuery.selectShareDirFromUid(uid), (err, rows) => {
                    if (rows && rows.length) {
                        dir_id_arr = rows.filter(item => item.dir_id)
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 通过被共享的目录id，查找出其他目录信息
                if (dir_id_arr && dir_id_arr.length) {
                    let reduced_arr = Util.reduceJsonArray(dir_id_arr, 'dir_id')
                    let childTasks = reduced_arr.map(item => {
                        return function(cb) {
                            connection.query(dirQuery.selectDirWithId(item.dir_id), (err, rows) => {
                                if (rows && rows.length) {
                                    let data = rows[0]
                                    data.perms_upload = item.perms_upload
                                    data.perms_download = item.perms_download
                                    data.perms_update = item.perms_update
                                    data.perms_delete = item.perms_delete
                                    dir_arr.push(data)
                                }
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
					Util.sendResult(res, 1000, '查询失败')
				});
			} else {
				connection.query('COMMIT', () => {
					Util.sendResult(res, 0, '查询成功', dir_arr)
				});
			}
            connection.release()
		});
	});
})

router.get('/getShareFileFromMe', (req, res, next) => {
    const uid = req.user.uid

    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let share_dir = undefined
        let file_arr = []
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询我共享的文件
                connection.query(shareQuery.selectShareDirFromUid(uid), (err, rows) => {
                    if (rows && rows.length) {
                        share_dir = rows
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 通过被共享的文件id，查找出其他文件信息
                let reduced_arr = Util.reduceJsonArray(dir_id_arr, 'file_id')
                let childTasks = reduced_arr.map(item => {
                    return function(cb) {
                        connection.query(fileQuery.selectFileWithFileId(item.file_id), (err, rows) => {
                            if (rows && rows.length) {
                                let data = rows[0]
                                data.perms_upload = item.perms_upload
                                data.perms_download = item.perms_download
                                data.perms_update = item.perms_update
                                data.perms_delete = item.perms_delete
                                file_arr.push(data)
                            }
                            cb(err)
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
					Util.sendResult(res, 1000, '查询失败')
				});
			} else {
				connection.query('COMMIT', () => {
					Util.sendResult(res, 0, '查询成功', file_arr)
				});
			}
            connection.release()
		});
	});
})

router.post('/shareDir', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    const {
        dir_id,
        with_uids,
        with_job_ids,
        with_dep_ids,
        perms_upload,
        perms_download,
        perms_update,
        perms_delete
    } = body

    if (!dir_id) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }

    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        
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
                    } else {
                        Util.sendResult(res, 1000, '当前目录不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 若有部门id，则以部门id添加到分享表
                if (with_dep_ids && with_dep_ids.length) {
                    let with_dep_id_arr = with_dep_ids.split(',')
                    let childTasks = with_dep_id_arr.map(item => {
                        let values = {
                            uid,
                            dir_id,
                            with_dep_id: item,
                            perms_upload,
                            perms_download,
                            perms_update,
                            perms_delete
                        }
                        return function(cb) {
                            connection.query(shareQuery.addShareDirWithDep(values), err => {
                                cb(err)
                            })
                        }
                    });
                    async.series(childTasks, err => {
                        callback(err)
                    })
                } else {
                    callback(null)
                }
            },
            function(callback) {
                // 若有岗位ID，以岗位ID添加到分享表
                if (with_job_ids && with_job_ids.length) {
                    let with_job_id_arr = with_job_ids.split(',')
                    let childTasks = with_job_id_arr.map(item => {
                        let values = {
                            uid,
                            dir_id,
                            with_job_id: item,
                            perms_upload,
                            perms_download,
                            perms_update,
                            perms_delete
                        }
                        return function(cb) {
                            connection.query(shareQuery.addShareDirWithJob(values), err => {
                                cb(err)
                            })
                        }
                    });
                    async.series(childTasks, err => {
                        callback(err)
                    })
                } else {
                    callback(null)
                }
            },
            function(callback) {
                // 若有用户ID，以用户ID添加到分享表
                if (with_uids && with_uids.length) {
                    let with_uid_arr = with_uids.split(',')
                    let childTasks = with_uid_arr.map(item => {
                        let values = {
                            uid,
                            dir_id,
                            with_uid: item,
                            perms_upload,
                            perms_download,
                            perms_update,
                            perms_delete
                        }
                        return function(cb) {
                            connection.query(shareQuery.addShareDirWithUser(values), err => {
                                cb(err)
                            })
                        }
                    });
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

router.post('/shareFile', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    const {
        file_id,
        with_uids,
        with_job_ids,
        with_dep_ids,
        perms_upload,
        perms_download,
        perms_update,
        perms_delete
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
                connection.query(fileQuery.selectFileWithFileId(file_id), (err, rows) => {
                    if (rows && rows.length) {
                    } else {
                        Util.sendResult(res, 1000, '当前文件不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 若有部门id，则以部门id添加到分享表
                if (with_dep_ids && with_dep_ids.length) {
                    let with_dep_id_arr = with_dep_ids.split(',')
                    let childTasks = with_dep_id_arr.map(item => {
                        let values = {
                            uid,
                            file_id,
                            with_dep_id: item,
                            perms_upload,
                            perms_download,
                            perms_update,
                            perms_delete
                        }
                        return function(cb) {
                            connection.query(shareQuery.addShareFileWithDep(values), err => {
                                cb(err)
                            })
                        }
                    });
                    async.series(childTasks, err => {
                        callback(err)
                    })
                } else {
                    callback(null)
                }
            },
            function(callback) {
                // 若有岗位ID，以岗位ID添加到分享表
                if (with_job_ids && with_job_ids.length) {
                    let with_job_id_arr = with_job_ids.split(',')
                    let childTasks = with_job_id_arr.map(item => {
                        let values = {
                            uid,
                            file_id,
                            with_job_id: item,
                            perms_upload,
                            perms_download,
                            perms_update,
                            perms_delete
                        }
                        return function(cb) {
                            connection.query(shareQuery.addShareFileWithJob(values), err => {
                                cb(err)
                            })
                        }
                    });
                    async.series(childTasks, err => {
                        callback(err)
                    })
                } else {
                    callback(null)
                }
            },
            function(callback) {
                // 若有用户ID，以用户ID添加到分享表
                if (with_uids && with_uids.length) {
                    let with_uid_arr = with_uids.split(',')
                    let childTasks = with_uid_arr.map(item => {
                        let values = {
                            uid,
                            file_id,
                            with_uid: item,
                            perms_upload,
                            perms_download,
                            perms_update,
                            perms_delete
                        }
                        return function(cb) {
                            connection.query(shareQuery.addShareFileWithUser(values), err => {
                                cb(err)
                            })
                        }
                    });
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

/**
 * @description 在共享目录中上传，需要提供以下参数
 * @param {Number} root_id 共享目录的根id，即共享给我的那个目录id，需要使用这个id来确定权限
 * @param {Number} dir_id 需要上传目录的id
 * @param {Binary} file 需要上传的文件
 */
router.post('/uploadFileForShare', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    let {
        root_id,
        dir_id
    } = body
    if (!req.files) {
        Util.sendResult(res, 1000, '请选择文件')
        return
    }
    if (!root_id || !dir_id) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }
    conn.getConnection(function(error, connection) {
        if (error) return
        let job_id = undefined
        let dep_id = undefined
        let dir_path = undefined
        let cur_dir_path = undefined
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
                // 查询用户的job_id和dep_id
                connection.query(userQuery.selectUserStaffWithUserId(uid), (err, rows) => {
                    if (rows && rows.length) {
                        job_id = rows[0].job_id
                        dep_id = rows[0].dep_id
                    }
                    callback(err)
                })
            },
            function(callback) {
                let upload_file = false
                let childTasks = [
                    function(cb) {
                        // 查询部门是否有这个root_id目录上传文件的权限
                        connection.query(shareQuery.selectShareDirWithDirAndDep(root_id, dep_id), (err, rows) => {
                            if (rows && rows.length && rows[0].perms_upload) {
                                upload_file = true
                            }
                            cb(err)
                        })
                    },
                    function(cb) {
                        // 查询岗位是否有这个root_id目录上传文件的权限
                        connection.query(shareQuery.selectShareDirWithDirAndJob(root_id, job_id), (err, rows) => {
                            if (rows && rows.length && rows[0].perms_upload) {
                                upload_file = true
                            }
                            cb(err)
                        })
                    },
                    function(cb) {
                        // 查询用户是否有这个root_id目录上传文件的权限
                        connection.query(shareQuery.selectShareDirWithDirAndUser(root_id, uid), (err, rows) => {
                            if (rows && rows.length && rows[0].perms_upload) {
                                upload_file = true
                            }
                            cb(err)
                        })
                    }
                ]
                async.series(childTasks, err => {
                    if (upload_file) {
                        callback(err)
                    } else {
                        Util.sendResult(res, 1004, '没有权限')
                        connection.release()
                        return
                    }
                })
            },
            function(callback) {
                // 查询当前目录是否存在
                connection.query(dirQuery.selectDirWithId(dir_id), (err, rows) => {
                    if (rows && rows.length) {
                        cur_dir_path = rows[0].dir_path
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 保存文件到服务器
                const childTasks = Object.values(req.files).map((file, index) => {
                    const path = `${cur_dir_path}/${file.name}`
                    return function(cb) {
                        // 查询当前文件路径是否存在
                        connection.query(fileQuery.selectFileWithPath(path), (err, rows) => {
                            if (rows && rows.length) {
                                failFiles.push(file.name)
                                cb(null)
                            } else {
                                const values = {
                                    dir_id,
                                    file_name: file.name,
                                    file_path: path,
                                    type: 1,
                                    ext: Util.getFileExt(file.name),
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

/**
 * @description 在共享目录中下载文件
 * @param {Number} root_id 共享目录的根id
 * @param {Number} file_id 需要下载的文件id
 */
router.post('/downloadFileForShare', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    let {
        root_id,
        file_id
    } = body
    if (!root_id || !file_id) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }
    conn.getConnection((error, connection) => {
        if (error) return

        let dep_id = undefined
        let job_id = undefined
        let file_path = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查找用户的dep_id和job_id
                connection.query(userQuery.selectUserStaffWithUserId(uid), (err, rows) => {
                    if (rows && rows.length) {
                        dep_id = rows[0].dep_id
                        job_id = rows[0].job_id
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 分别使用dep_id、job_id、uid查找root_id的下载文件的权限
                let download_file = false
                let childTasks = [
                    function(cb) {
                        connection.query(shareQuery.selectShareDirWithDirAndDep(root_id, dep_id), (err, rows) => {
                            if (rows && rows.length && rows[0].perms_download) {
                                download_file = true
                            }
                            cb(err)
                        })
                    },
                    function(cb) {
                        connection.query(shareQuery.selectShareDirWithDirAndJob(root_id, job_id), (err, rows) => {
                            if (rows && rows.length && rows[0].perms_download) {
                                download_file = true
                            }
                            cb(err)
                        })
                    },
                    function(cb) {
                        connection.query(shareQuery.selectShareDirWithDirAndUser(root_id, uid), (err, rows) => {
                            if (rows && rows.length && rows[0].perms_download) {
                                download_file = true
                            }
                            cb(err)
                        })
                    }
                ]
                async.series(childTasks, err => {
                    if (download_file) {
                        callback(err)
                    } else {
                        Util.sendResult(res, 1004, '没有权限')
                        connection.release()
                        return
                    }
                })
            },
            function(callback) {
                // 下载文件
                connection.query(fileQuery.selectFileWithFileId(file_id), (err, rows) => {
                    if (rows && rows.length) {
                        file_path = rows[0].file_path
                    }
                    callback(err)
                })
            }
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '下载失败')
				});
			} else {
				connection.query('COMMIT', () => {
					res.download(file_path)
				});
			}
            connection.release()
		});
    })
})

module.exports = router;
