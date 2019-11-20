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

router.post('/addDepartment', async (req, res, next) => {
	const obj = req.body
	const uid = req.user.uid
	obj.create_uid = uid
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
				// 先查找部门上一级是否存在，返回上级目录或''
				if (obj.par_id) {
					connection.query(depQuery.selectDepWithId(obj.par_id), (err, rows) => {
						if (rows && rows.length && rows[0].dep_id) {
							callback(err, rows[0].dep_dir)
						} else {
							callback(err, null)
						}
					})
				} else callback(null, null)
			},
			function(dir, callback) {
				// 再查看当前目录是否存在，返回上级目录或''
				const currentDir = `${dir}/${obj.dep_name}`
				connection.query(depQuery.selectDepWithDir(currentDir), (err, rows) => {
					if (err) callback(err)
					else if (rows && rows.length) {
						connection.query('ROLLBACK', err => {
							Util.sendResult(res, 1001, '同级下已存在同名部门')
							connection.release()
						});
					} else {
						callback(err, dir)
					}
				})
			},
			function(dir, callback) {
				obj.dep_dir = dir ? `${dir}/${obj.dep_name}` : `${staffRootDir}/${obj.dep_name}`
				// 添加数据到部门表，返回上级目录
				connection.query(depQuery.addDepartment(obj), err => {
					callback(err, dir)
				});
			},
			function(dir, callback) {
				// 根据上一步的返回的上级目录，查找是否存在于目录表，返回dir_id或null
				connection.query(dirQuery.selectDirWithPath(dir), (err, rows) => {
					if (rows && rows.length) {
						callback(err, rows[0].dir_id, rows[0].dir_path)
					} else {
						callback(err, null, null)
					}
				})
			},
			function(id, path, callback) {
				const dep_dir = path ? `${path}/${obj.dep_name}` : `${staffRootDir}/${obj.dep_name}`
				// 添加数据到目录表
				connection.query(dirQuery.addDir({
					dir_pid: id || 0,
					dir_name: obj.dep_name,
					path: dep_dir,
					uniq: uuidv1(),
					create_uid: uid
				}), err => {
					callback(err, dep_dir)
				})
			},
			function(path, callback) {
				// 查询刚添加的目录的dir_id，返回dir_id和dep_dir
				connection.query(dirQuery.selectDirWithPath(path), (err, rows) => {
					callback(err, rows.length && rows[0].dir_id, path)
				})
			},
			function(dir_id, path, callback) {
				const dep_dir = `${path}/${obj.dep_name}共享`
				// 添加共享目录到目录表
				connection.query(dirQuery.addDirShare({
					dir_pid: dir_id,
					dir_name: Util.getDirOrFileName(dep_dir),
					path: dep_dir,
					uniq: uuidv1(),
					create_uid: uid
				}), err => {
					callback(err, path, dep_dir)
				});
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
					// 创建部门和部门分享文件夹
					Util.createStaffDir(path)
					Util.createStaffDir(dep_dir)
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
		let old_name = undefined
		let old_path = undefined
		let all_path = undefined
		let all_dep_path = undefined
		let new_path = undefined
		let old_share_path = undefined
		let new_share_path = undefined
		let new_share_name = undefined
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
						new_path = old_path.replace(old_name, body.new_name)
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询旧部门下的所有部门(部门表)
				connection.query(depQuery.selectDepLikePath(old_path), (err, rows) => {
					if (rows && rows.length) {
						all_dep_path = rows
					}
					callback(err)
				})
			},
			function(callback) {
				// 使用task来修改部门表下所有相关部门的路径
				const childTasks = all_dep_path.map(item => {
					const new_item_path = item.dep_dir.replace(old_path, new_path)
					return function(callback) {
						connection.query(depQuery.updateDepPathWithPath(item.dep_dir, new_item_path, uid), err => {
							callback(err)
						})
					}
				})
				async.series(childTasks, err => {
					callback(err)
				})
			},
			function(callback) {
				// 查询旧目录下的所有目录(目录表)
				connection.query(dirQuery.selectDirLikePath(old_path), (err, rows) => {
					if (rows && rows.length) {
						all_path = rows
					}
					callback(err)
				})
			},
			function (callback) {
				// 查询该部门的共享目录
				connection.query(dirQuery.selectShareDirWithPath(old_path), (err, rows) => {
					if (rows && rows.length) {
						old_share_path = rows[0].dir_path
					}
					callback(err)
				})
			},
			function(callback) {
				// 修改对应部门共享目录的名称和路径
				new_share_name= `${body.new_name}共享`
				new_share_path = `${new_path}/${new_share_name}`
				connection.query(dirQuery.updateDirNameWithPath(old_share_path, new_share_name, new_share_path, uid), err => {
					callback(err)
				})
			},
			function (callback) {
				// 修改该部门的目录名称和目录路径（目录表）
				connection.query(dirQuery.updateDirNameWithPath(old_path, body.new_name, new_path, uid), err => {
					callback(err)
				})
			},
			function(callback) {
				// 使用task来修改目录表下所有相关目录的名称和路径(除共享)
				const childTasks = all_path.map(item => {
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
				// 修改部门名称和路径
				connection.query(depQuery.updateDepNameWithId(body.dep_id, body.new_name, new_path, uid), err => {
					callback(err)
				})
			}
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1001, '更新失败')
				});
			}
			else {
				connection.query('COMMIT', () => {
					fs.renameSync(old_share_path, `${old_path}/${new_share_name}`)
					fs.renameSync(old_path, new_path)
					Util.sendResult(res, 0, '更新成功')
				});
			}
			connection.release()
		});
	});
})

module.exports = router;
