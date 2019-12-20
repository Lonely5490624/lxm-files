var express = require('express');
var router = express.Router();
var fs = require('fs');
var async = require('async')

var Util = require('../controller/util')
const uuidv1 = require('uuid/v1')
const depQuery = require('../config/queries/department')
const dirQuery = require('../config/queries/dir')
const conn = require('../config/connection')
const trans = require('../config/transaction')

const staffRootDir = `${process.cwd()}/files/staff`
const staffShareDir = `${process.cwd()}/files/share`

router.get('/getDepartment', (req, res, next) => {
	conn.getConnection((error, connection) => {
		if (error) return;
		connection.query(depQuery.selectDepAll(), (err, rows) => {
			if (rows && rows.length) {
				let data = Util.listToTree(rows, 'dep_id', 'par_id')
				Util.sendResult(res, 0 ,'查询成功', data)
				connection.release()
			}
		})
	})
})

router.post('/addDepartment', (req, res, next) => {
	const obj = req.body
	const uid = req.user.uid
	obj.create_uid = uid
	let {
		par_id,
		dep_name
	} = obj
	if (!par_id || !dep_name) {
		Util.sendResult(res, 1003, '参数缺失')
		return
	}
	conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
		}
		let show_name = dep_name
		let true_name = Date.parse(new Date()) + dep_name
		let show_path = show_name

		let par_dir = undefined			// 上级部门目录
		let par_dir_id = undefined		// 上级部门目录的目录id
		let dir_path = undefined			// 部门目录
		let dir_path_id = undefined		// 部门目录的目录id
		let dir_share_path = undefined	// 部门共享目录
		let dir_share_path_id = undefined// 部门共享目录的目录id
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
			},
			function(callback) {
				// 先查找部门上一级是否存在
				if (obj.par_id) {
					connection.query(depQuery.selectDepWithId(obj.par_id), (err, rows) => {
						if (rows && rows.length && rows[0].dep_id) {
							par_dir = rows[0].dep_dir
						}
						callback(err)
					})
				} else {
					Util.sendResult(res, 1000, '上级部门不存在')
					connection.release()
				}
			},
			function(callback) {
				// 再查看当前部门是否存在，返回上级目录或''
				dir_path = `${par_dir}/${true_name}`
				connection.query(`SELECT * FROM lxm_user_department WHERE dep_name = '${show_name}' AND is_delete = 0`, (err, rows) => {
					if (err) callback(err)
					else if (rows && rows.length) {
						Util.sendResult(res, 1000, '同级下已存在同名部门')
						connection.release()
					} else {
						callback(err)
					}
				})
			},
			function(callback) {
				obj.dep_dir = par_dir ? `${par_dir}/${true_name}` : `${staffRootDir}/${true_name}`
				// 添加数据到部门表，返回上级目录
				connection.query(depQuery.addDepartment(obj), err => {
					callback(err)
				});
			},
			function(callback) {
				// 根据上一步的返回的上级目录，查找是否存在于目录表，返回dir_id或null
				connection.query(dirQuery.selectDirWithPath(par_dir), (err, rows) => {
					if (rows && rows.length) {
						par_dir_id = rows[0].dir_id
						show_path = `${rows[0].dir_name}/${show_name}`
						callback(err)
					} else {
						callback(err)
					}
				})
			},
			function(callback) {
				dir_path = par_dir ? `${par_dir}/${true_name}` : `${staffRootDir}/${true_name}`
				// 添加部门目录数据到目录表
				connection.query(dirQuery.addDir({
					dir_pid: par_dir_id || 0,
					dir_name: show_path,
					path: dir_path,
					uniq: uuidv1(),
					create_uid: uid
				}), err => {
					callback(err)
				})
			}
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', (err2) => {
					Util.sendResult(res, 1001, '创建失败')
				});
			} else {
				connection.query('COMMIT', () => {
					// 创建部门文件夹
					Util.createStaffDir(dir_path)
					Util.sendResult(res, 0, '创建成功')
				});
			}
			connection.release()
		});
	});
})

router.post('/updateDepartment', (req, res, next) => {
	/**
	 * @dep_id 要修改的部门id
	 * @new_name 新部门的名字
	 */
	const body = req.body
	const uid = req.user.uid
	conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
		}
		const {
			dep_id,
			new_name
		} = body
		let show_name = new_name
		let true_name = Date.parse(new Date()) + show_name
		let show_path = show_name
		let par_id = undefined

		let old_name = undefined
		let old_path = undefined
		let all_path = undefined
		let all_dep_path = undefined
		let new_path = `${staffRootDir}/${true_name}`

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
				connection.query(depQuery.selectDepWithId(body.dep_id), (err, rows) => {
					if (rows && rows.length) {
						old_name = rows[0].dep_name
						old_path = rows[0].dep_dir
						par_id = rows[0].par_id
					}
					callback(err)
				})
			},
			function(callback) {
				// 如果当前部门不是顶级部门，则找到上级部门的目录名称，再来确认现级部门的目录名称
				if (par_id === 0) {
					callback(null)
				} else {
					connection.query(`SELECT * FROM lxm_user_department WHERE dep_id = ${par_id} AND is_delete = 0`, (err, rows) => {
						if (rows && rows.length) {
							connection.query(`SELECT * FROM lxm_file_dir WHERE dir_path = '${rows[0].dep_dir}' AND is_delete = 0`, (err2, rows2) => {
								console.log(33333, rows2)
								if (rows2 && rows2.length) {
									show_path = `${rows2[0].dir_name}/${show_name}`
									new_path = `${rows2[0].dir_path}/${true_name}`
								}
								callback(err2)
							})
						} else {
							callback(err)
						}
					})
				}
			},
			function(callback) {
				// 修改部门表的名称和目录
				connection.query(depQuery.updateDepNameWithId(dep_id, show_name, new_path, uid), err => {
					callback(err)
				})
			},
			function(callback) {
				// 修改岗位表的目录
				connection.query(`UPDATE lxm_user_job SET job_dir=REPLACE(job_dir, '${old_path}', '${new_path}')`, err => {
					callback(err)
				})
			},
			function(callback) {
				// 修改用户表的目录
				connection.query(`UPDATE lxm_user_staff SET homefolder=REPLACE(homefolder, '${old_path}', '${new_path}')`, err => {
					callback(err)
				})
			},
			function(callback) {
				// 修改目录表的名称
				connection.query(`UPDATE lxm_file_dir SET dir_name='${show_path}' WHERE dir_path='${old_path}'`, err => {
					callback(err)
				})
			},
			function(callback) {
				// 修改目录表的目录
				connection.query(`UPDATE lxm_file_dir SET dir_path=REPLACE(dir_path, '${old_path}', '${new_path}')`, err => {
					callback(err)
				})
			},
			function(callback) {
				// 修改文件表中的目录
				connection.query(`UPDATE lxm_file_file SET file_path=REPLACE(file_path, '${old_path}', '${new_path}')`, err =>{
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
			}
			else {
				connection.query('COMMIT', () => {
					fs.renameSync(old_path, new_path)
					Util.sendResult(res, 0, '更新成功')
				});
			}
			connection.release()
		});
	});
})

router.post('/deleteDep', (req, res, next) => {
    const uid = req.user.uid
    const {
        dep_id
    } = req.body
    if (!dep_id) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }

    conn.getConnection((error, connection) => {
		if (error) return;
		let dep_dir = undefined

        const tasks = [
            function(callback) {
                connection.query('BEGIN', err => {
                    callback(err)
                })
			},
			function(callback) {
				// 查询部门是否存在
				connection.query(`SELECT * FROM lxm_user_department WHERE dep_id=${dep_id} AND is_delete=0`, (err, rows) =>{
					if (rows && rows.length) {
						dep_dir = rows[0].dep_dir
					} else {
						Util.sendResult(res, 1000, '部门不存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询部门下是否还有岗位
				connection.query(`SELECT * FROM lxm_user_department WHERE par_id=${dep_id} AND is_delete=0`, (err, rows) => {
					if (rows && rows.length) {
						Util.sendResult(res, 1000, '部门下还有部门')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询部门下是否还有岗位
				connection.query(`SELECT * FROM lxm_user_job WHERE dep_id=${dep_id} AND is_delete=0`, (err, rows) => {
					if (rows && rows.length) {
						Util.sendResult(res, 1000, '部门下还有岗位')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询部门下是否还有文件
                connection.query(`SELECT * FROM lxm_file_file WHERE file_path like '${dep_dir}%' AND is_delete=0`, (err, rows) => {
                    if (rows && rows.length) {
                        Util.sendResult(res, 1000, '部门目录下还有文件')
                        connection.release()
                        return
                    }
                    callback(err)
                })
			},
            function(callback) {
                // 查询部门目录下是否还有目录
                connection.query(`SELECT * FROM lxm_file_dir WHERE dir_path REGEXP '${dep_dir}.+' AND is_delete=0`, (err, rows) => {
                    if (rows && rows.length) {
                        Util.sendResult(res, 1000, '部门目录下还有目录')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 删除目录表下的部门目录数据
                connection.query(`UPDATE lxm_file_dir SET is_delete=1, delete_uid='${uid}', delete_time=NOW() WHERE dir_path='${dep_dir}' AND is_delete=0`, err => {
                    callback(err)
                })
            },
            function(callback) {
                // 删除部门表中的部门数据
                connection.query(`UPDATE lxm_user_department SET is_delete=1, delete_uid='${uid}', delete_time=NOW() WHERE dep_id='${dep_id}' AND is_delete=0`, err => {
                    callback(err)
                })
            }
        ]
        async.waterfall(tasks, err => {
            if (err) {
                console.error(err)
                connection.query('ROLLBACK', () => {
                    Util.sendResult(res, 1000, '删除失败')
                })
            } else {
                connection.query('COMMIT', () => {
                    Util.sendResult(res, 0, '删除成功')
                })
            }
            connection.release()
        })
    })
})

module.exports = router;
