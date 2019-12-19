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

router.get('/getJobList', (req, res, next) => {
    const dep_id = req.query.dep_id
    const uid = req.user.uid
    if (!dep_id) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }
    conn.getConnection((error, connection) => {
        if (error) return
        connection.query(jobQuery.selectJobWithDepId(dep_id), (err, rows) => {
            if (rows && rows.length) {
                Util.sendResult(res, 0, '查询成功', rows)
                connection.release()
            } else {
                Util.sendResult(res, 0, '查询失败')
                connection.release()
            }
        })
    })
})

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
            is_manager,
            dep_set,
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
        let show_name = job_name
        let true_name = Date.parse(new Date()) + show_name

        let dep_dir = undefined
        let dep_share_dir = undefined
        let dep_share_dir_id = undefined
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
                        dep_share_dir = rows[0].share_dir
                        job_dir = `${dep_dir}/${true_name}`
                        job_share_name = `${job_name}共享`
                        job_share_dir = `${dep_share_dir}/${job_name}共享`
                    } else {
                        Util.sendResult(res, 1000, '部门ID错误')
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查看当前岗位是否存在
                connection.query(`SELECT * FROM lxm_user_job WHERE job_name = '${show_name}' AND is_delete = 0`, (err, rows) => {
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
                    job_name: show_name,
                    job_dir,
                    is_manager: is_manager ? 1 : 0,
                    dep_set: dep_set ? 1 : 0,
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
                    dir_name: show_name,
                    path: job_dir,
                    uniq: uuidv1(),
                    create_uid: uid
                }
                connection.query(dirQuery.addDir(values), err => {
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
					Util.sendResult(res, 1000, '创建失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    // 创建岗位和岗位共享文件夹
                    Util.createStaffDir(job_dir)
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
        let show_name = new_name
        let true_name = Date.parse(new Date()) + show_name

        let old_name = undefined
        let old_path = undefined
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
                // 查询岗位是否存在
                connection.query(jobQuery.selectJobWithId(job_id), (err, rows) => {
                    if (rows && rows.length) {
                        old_name =rows[0].job_name
                        old_path = rows[0].job_dir
                        let old_path_arr = old_path.split('/')
                        old_path_arr[old_path_arr.length - 1] = true_name
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
                // 修改岗位表的名称和目录
                connection.query(jobQuery.updateJobNameWithId(job_id, show_name, new_path, uid), (err, rows) =>{
                    callback(err)
                })
            },
            function(callback) {
                // 修改用户表的目录
                connection.query(`UPDATE lxm_user_staff SET homefolder=REPLACE(homefolder, '${old_path}', '${new_path}')`, (err, rows) => {
                    callback(err)
                })
            },
            function(callback) {
                // 修改目录表的名称
                connection.query(`UPDATE lxm_file_dir SET dir_name = '${show_name}' WHERE dir_name = '${old_name}'`, err => {
                    callback(err)
                })
            },
            function(callback) {
                // 修改目录表的目录
                connection.query(`UPDATE lxm_file_dir SET dir_path=REPLACE(dir_path, '${old_path}', '${new_path}')`, (err, rows) => {
                    callback(err)
                })
            },
            function(callback) {
                // 修改文件表中的目录
                connection.query(`UPDATE lxm_file_file SET file_path=REPLACE(file_path, '${old_path}', '${new_path}')`, (err, rows) => {
                    callback(err)
                })
            }
		]
		async.waterfall(tasks, function(err, path, dep_dir) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '更新失败')
				});
			} else {
				connection.query('COMMIT', () => {
                    // 更新岗位和岗位共享文件夹
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