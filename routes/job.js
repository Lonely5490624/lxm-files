var express = require('express');
var router = express.Router();
var fs = require('fs');
var async = require('async')

var Util = require('../controller/util')
const uuidv1 = require('uuid/v1')
const depQuery = require('../config/queries/department')
const jobQuery = require('../config/queries/job')
const dirQuery = require('../config/queries/dir')
const perQuery = require('../config/queries/permission')
const conn = require('../config/connection')

router.post('/addJob', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    body.create_uid = uid
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let {
            dep_id,
            job_name,
            create_user,
            modify_userinfo,
            modify_password,
            create_dir,
            upload_file,
            download_file,
            delete_file,
            delete_dir,
            rename_file,
            rename_dir
        } = body

        if (!dep_id || !job_name) {
            Util.sendResult(res, 1003, '参数缺失')
            return
        }
        let dep_dir = undefined
        let job_dir = undefined
        let job_share_name = undefined
        let job_share_dir = undefined
        let dep_dir_id = undefined
        let job_dir_id = undefined
        let job_id = undefined
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询部门是否存在
                connection.query(depQuery.selectDepWithId(dep_id), (err, rows) => {
                    if (rows && rows.length) {
                        dep_dir = rows[0].dep_dir
                        job_dir = `${dep_dir}/${job_name}`
                        job_share_name = `${job_name}共享`
                        job_share_dir = `${job_dir}/${job_name}共享`
                    } else {
                        Util.sendResult(res, 1000, '部门ID错误')
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查看当前岗位是否存在
                connection.query(jobQuery.selectJobWithPath(job_dir), (err, rows) => {
                    if (rows && rows.lenght) {
                        Util.sendResult(res, 1000, '该部门下已存在同名岗位')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 新建岗位数据
                const values = {
                    job_name,
                    job_dir,
                    dep_id,
                    create_uid: uid
                }
                connection.query(jobQuery.addJob(values), err => {
                    callback(err)
                })
            },
            function(callback) {
                // 查询新建的岗位的信息
                connection.query(jobQuery.selectJobWithPath(job_dir), (err, rows) => {
                    if (rows && rows.length) {
                        job_id = rows[0].job_id
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询部门目录dir_id
                connection.query(dirQuery.selectDirWithPath(dep_dir), (err, rows) => {
                    if (rows && rows.length) {
                        dep_dir_id = rows[0].dir_id
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 创建岗位目录
                const values = {
                    dir_pid: dep_dir_id,
                    dir_name: job_name,
                    path: job_dir,
                    uniq: uuidv1(),
                    create_uid: uid
                }
                connection.query(dirQuery.addDir(values), err => {
                    callback(err)
                })
            },
            function(callback) {
                // 查询岗位目录dir_id
                connection.query(dirQuery.selectDirWithPath(job_dir), (err, rows) => {
                    if (rows && rows.length) {
                        job_dir_id = rows[0].dir_id
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 新建岗位共享目录
                const values = {
                    dir_pid: job_dir_id,
                    dir_name: job_share_name,
                    path: job_share_dir,
                    uniq: uuidv1(),
                    create_uid: uid
                }
                connection.query(dirQuery.addDirShare(values), err => {
                    callback(err)
                })
            },
            function(callback) {
                // 添加岗位的权限
                let values = {
                    job_id,
                    create_user,
                    modify_userinfo,
                    modify_password,
                    create_dir,
                    upload_file,
                    download_file,
                    delete_file,
                    delete_dir,
                    rename_file,
                    rename_dir
                }
                connection.query(perQuery.addJobPermission(values), err => {
                    callback(err)
                })
            }
		]
		async.waterfall(tasks, function(err, path, dep_dir) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', (err2) => {
					Util.sendResult(res, 1001, '创建失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    // 创建岗位和岗位共享文件夹
                    Util.createStaffDir(job_dir)
                    Util.createStaffDir(job_share_dir)
					Util.sendResult(res, 0, '创建成功')
				});
			}
            connection.release()
		});
	});
})

router.post('/updateJob', (req, res, next) => {
    const body = req.body
    const uid = req.user.uid
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let {
            job_id,
            new_name
        } = body
        if (!job_id || !new_name) {
            Util.sendResult(res, 1003, '参数缺失')
            return
        }
        let old_name = undefined
        let old_path = undefined
        let new_path = undefined
        let all_jobs = undefined
        let all_job_dirs = undefined
        let old_share_path = undefined
        let new_share_name = undefined
        let new_share_path = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询岗位是否存在
                connection.query(jobQuery.selectJobWithId(job_id), (err, rows) => {
                    if (rows && rows.length) {
                        old_name =rows[0].job_name
                        old_path = rows[0].job_dir
                        let old_path_arr = old_path.split('/')
                        old_path_arr[old_path_arr.length - 1] = new_name
                        new_path = old_path_arr.join('/')
                    } else {
                        Util.sendResult(res, 1000, '岗位不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询岗位下所有岗位
                connection.query(jobQuery.selectJobLikePath(old_path), (err, rows) => {
                    if (rows && rows.length) {
                        all_jobs = rows
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 修改所有岗位路径
                const childTasks = all_jobs.map(item => {
					const new_item_path = item.job_dir.replace(old_path, new_path)
					return function(callback) {
						connection.query(jobQuery.updateJobPathWithPath(item.job_dir, new_item_path, uid), err => {
							callback(err)
						})
					}
				})
				async.series(childTasks, err => {
					callback(err)
				})
            },
            function(callback) {
                // 查询岗位目录下所有目录
                connection.query(dirQuery.selectDirLikePath(old_path), (err, rows) => {
                    if (rows && rows.length) {
                        all_job_dirs = rows
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询岗位目录下共享目录
                connection.query(dirQuery.selectShareDirWithPath(old_path), (err, rows) => {
                    if (rows && rows.length) {
                        old_share_path = rows[0].dir_path
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 修改共享目录的名称和路径
                new_share_name = `${new_name}共享`
                new_share_path = `${new_path}/${new_share_name}`
                connection.query(dirQuery.updateDirNameWithPath(old_share_path, new_share_name, new_share_path, uid), err => {
                    callback(err)
                })
            },
            function(callback) {
                // 修改岗位目录的名称和路径(目录表)
				connection.query(dirQuery.updateDirNameWithPath(old_path, new_name, new_path, uid), err => {
					callback(err)
				})
            },
            function(callback) {
                // 使用task来修改目录表下所有相关目录的名称和路径(除共享)
				const childTasks = all_job_dirs.map(item => {
					const new_item_path = item.dir_path.replace(old_path, new_path)
					return function(callback) {
						connection.query(dirQuery.updateDirPathWithPath(item.dir_path, new_item_path, uid), err => {
							callback(err)
						})
					}
				})
				async.series(childTasks, err => {
					callback(err)
				})
            },
            function(callback) {
                // 修改岗位名称和路径
				connection.query(jobQuery.updateJobNameWithId(job_id, new_name, new_path, uid), err => {
					callback(err)
				})
            }
		]
		async.waterfall(tasks, function(err, path, dep_dir) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1001, '更新失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    // 更新岗位和岗位共享文件夹
					fs.renameSync(old_share_path, `${old_path}/${new_share_name}`)
					fs.renameSync(old_path, new_path)
					Util.sendResult(res, 0, '更新成功')
				});
			}
            connection.release()
		});
	});
})

router.get('/getJobList', (req, res, next) => {
    console.log(req.user)
    conn.getConnection(function(error, connection) {
        connection.query(jobQuery.selectJobList(), (err, rows) => {
            Util.sendResult(res, 0, '查询成功', rows)
            connection.release()
        })
    })
})

module.exports = router