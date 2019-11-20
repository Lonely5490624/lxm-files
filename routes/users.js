var express = require("express");
var router = express.Router();
var fs = require("fs");
var async = require("async");

var Util = require("../controller/util");
const uuidv1 = require("uuid/v1");
const conn = require("../config/connection");
const userQuery = require("../config/queries/user");
const depQuery = require("../config/queries/department");
const jobQuery = require("../config/queries/job");
const dirQuery = require('../config/queries/dir')
const perQuery = require('../config/queries/permission')

router.post('/superReg', (req, res, next) => {
    conn.getConnection(function(error, connection) {
		connection.query(`INSERT INTO lxm_user_staff (
			uid,
			username,
			password,
			homefolder,
			dep_id,
			job_id,
			job_number,
			phone_number,
			true_name,
			nick_name,
			gender,
			age,
			ID_card,
			create_uid,
			create_time
		) VALUES (
			'${uuidv1()}',
			'lexuemao',
			'${Util.genPassword('123456')}',
			'${process.cwd()}/files',
			0,
			0,
			'001',
			'16666666666',
			'超级管理员',
			'乐学猫',
			1,
			18,
			'50192119990909999X',
			0,
			NOW()
		)`, err => {
			if (err) {
				console.log(err)
				Util.sendResult(res, 1000, '注册错误')
			} else {
				Util.sendResult(res, 0, '注册成功')
			}
            connection.release()
		})
	});
})

// 普通用户注册
router.post('/regUserCommon', (req, res, next) => {
	const body = req.body
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
		}
		const {
			username,
			password
		} = body
		if (!username || !password) {
			Util.sendResult(res, 1003, '参数缺失')
			return
		}
		let new_user = undefined
		let homefolder = undefined

		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
			},
			function(callback) {
				// 查询普通用户表是否存在
				connection.query(userQuery.selectUserCommonWithUsername(username), (err, rows) => {
					if (rows && rows.length) {
						Util.sendResult(res, 1000, '用户名已存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询员工表是否存在
				connection.query(userQuery.selectUserStaffWithUsername(username), (err, rows) => {
					if (rows && rows.length) {
						Util.sendResult(res, 1000, '用户名已存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 写入普通用户表
				homefolder = `${process.cwd()}/files/common/${username}`
				const values = {
					uid: uuidv1(),
					username,
					password: Util.genPassword(password),
					homefolder
				}
				connection.query(userQuery.addUserCommon(values), err => {
					callback(err)
				})
			},
			function(callback) {
				// 查询出刚注册的用户信息
				connection.query(userQuery.selectUserCommonWithUsername(username), (err, rows) => {
					if (rows && rows.length) {
						new_user = rows[0]
					}
					callback(err)
				})
			}
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', (err2) => {
					Util.sendResult(res, 1000, '注册失败')
				});
			} else {
				connection.query('COMMIT', () => {
					let data = {
						uid: new_user.uid
					}
					Util.createStaffDir(homefolder)
					Util.sendResult(res, 0, '注册成功', data)
				});
			}
            connection.release()
		});
	});
})

router.post("/regUserStaff", async (req, res, next) => {
	const body = req.body
	const uid = req.user.uid
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let {
            username,
			password,
			dep_id,
			job_id,
			job_number,
			phone_number,
			true_name,
			nick_name,
			ID_card
		} = body
        if (!username || !password || !dep_id || !job_id || !job_number || !phone_number || !true_name || !ID_card) {
            Util.sendResult(res, 1003, '参数缺失')
            return
		}
		let job_dir = undefined
		let homefolder = undefined
		let new_user = undefined
		let dir_pid = undefined

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
					if (rows && rows.length && rows[0].create_user) {
					} else {
						Util.sendResult(res, 1004, '没有权限')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询普通用户表是否有相同用户名
				connection.query(userQuery.selectUserCommonWithUsername(username), (err, rows) => {
					if (rows && rows.length) {
						Util.sendResult(res, 1000, '用户名已存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询员工表是否有相同用户名
				connection.query(userQuery.selectUserStaffWithUsername(username), (err, rows) => {
					if (rows && rows.length) {
						Util.sendResult(res, 1000, '用户名已存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询部门是否存在
				connection.query(depQuery.selectDepWithId(dep_id), (err, rows) => {
					if (rows && rows.length) {
						
					} else {
						Util.sendResult(res, 1000, '部门不存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询岗位是否存在
				connection.query(jobQuery.selectJobWithId(job_id), (err, rows) => {
					if (rows && rows.length) {
						job_dir = rows[0].job_dir
						homefolder = `${job_dir}/${username}`
					} else {
						Util.sendResult(res, 1000, '岗位不存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询岗位的目录id
				connection.query(dirQuery.selectDirWithPath(job_dir), (err, rows) => {
					if (rows && rows.length) {
						dir_pid = rows[0].dir_id
					} else {
						Util.sendResult(res, 1000, '岗位目录不存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 创建员工信息
				let values = {
					uid: uuidv1(),
					username,
					password: Util.genPassword(password),
					homefolder,
					dep_id,
					job_id,
					job_number,
					phone_number,
					true_name,
					nick_name,
					ID_card,
					create_uid: uid
				}
				connection.query(userQuery.addUserStaff(values), err => {
					callback(err)
				})
			},
			function(callback) {
				// 将员工的目录添加到目录表
				let values = {
					dir_pid,
					dir_name: username,
					path: homefolder,
					uniq: uuidv1(),
					create_uid: uid
				}
				connection.query(dirQuery.addDir(values), err => {
					callback(err)
				})
			},
			function(callback) {
				// 查询刚添加的用户信息，返回给前端
				connection.query(userQuery.selectUserStaffWithUsername(username), (err, rows) => {
					if (rows && rows.length) {
						new_user = rows[0]
					}
					callback(err)
				})
			}
		]
		async.waterfall(tasks, function(err) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', (err2) => {
					Util.sendResult(res, 1000, '创建失败')
				});
			} else {
				connection.query('COMMIT', () => {
					let data = {
						uid: new_user.uid
					}
					Util.createStaffDir(homefolder)
					Util.sendResult(res, 0, '创建成功', data)
				});
			}
            connection.release()
		});
	});
});

router.post('/login', (req, res, next) => {
    const body = req.body
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
        }
        let {
            username,
			password
		} = body
        if (!username || !password) {
            Util.sendResult(res, 1003, '参数缺失')
            return
		}
		let user_info = undefined

		// 查询员工用户表是否存在（员工表和用户表的用户名不能相同）
		connection.query(userQuery.selectUserStaffWithUsername(username), (err, rows) => {
			if (err) {
				console.log(err)
				Util.sendResult(res, 1000, '服务器内部错误')
			} else if (rows && rows.length) {
				if (Util.comparePassword(password, rows[0].password)) {
					connection.query(userQuery.updateStaffLoginTimeWithUid(rows[0].uid))
					const token = Util.genToken({
						uid: rows[0].uid,
						dep_id: rows[0].dep_id,
						job_id: rows[0].job_id
					})
					const data = {
						username,
						token
					}
					res.cookie('token', token)
					Util.sendResult(res, 0, '登录成功', data)
				} else {
					Util.sendResult(res, 1000, '密码错误')
				}
			} else {
				// 若员工用户表不存在，则查询普通用户表是否存在
				connection.query(userQuery.selectUserCommonWithUsername(username), (err2, rows2) => {
					if (err2) {
						console.log(err2)
					} else if (rows2 && rows2.length) {
						if (Util.comparePassword(password, rows2[0].password)) {
							const token = Util.genToken({
								uid: rows2[0].uid
							})
							const data = {
								username,
								token
							}
							res.cookie(token, token)
							Util.sendResult(res, 0, '登录成功', data)
						} else {
							Util.sendResult(res, 1000, '密码错误')
						}
					} else {
						Util.sendResult(res, 1000, '用户不存在')
					}
				})
			}
            connection.release()
		})
	});
})

router.post('/logout', (req, res, next) => {
	// 退出清除token的cookie
	res.clearCookie('token')
	Util.sendResult(res, 0, '退出成功')
})

module.exports = router;
