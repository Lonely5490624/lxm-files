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

router.post("/regUserStaff", (req, res, next) => {
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
			phone_number,
			true_name,
			nick_name,
			ID_card
		} = body
        if (!username || !password || !dep_id || !job_id || !phone_number || !true_name || !ID_card) {
            Util.sendResult(res, 1003, '参数缺失')
            return
		}
		let show_name = username
		let trueName = Date.parse(new Date()) + show_name
		let show_path = undefined

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
				// 查询电话号码是否重复
				connection.query(`SELECT * FROM lxm_user_staff WHERE phone_number='${phone_number}' AND is_delete=0`, (err, rows) => {
					if (rows && rows.length) {
						Util.sendResult(res, 1000, '手机号码已存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询身份证号码是否重复
				connection.query(`SELECT * FROM lxm_user_staff WHERE ID_card='${ID_card}' AND is_delete=0`, (err, rows) => {
					if (rows && rows.length) {
						Util.sendResult(res, 1000, '身份证号码已存在')
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
						homefolder = `${job_dir}/${trueName}`
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
						show_path = `${rows[0].dir_name}/${show_name}`
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
					show_path,
					homefolder,
					dep_id,
					job_id,
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
					dir_name: show_path,
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

router.get('/getUserStaff', (req, res, next) => {
	const job_id = req.query.job_id
	const uid = req.user.uid
	if (!job_id) {
		Util.sendResult(res, 1003, '参数缺失')
		return
	}
	conn.getConnection((error, connection) => {
		if (error) return
		connection.query(userQuery.selectUserStaffWithJobId(job_id), (err, rows) => {
			if (rows) {
				Util.sendResult(res, 0, '查询成功', rows)
			}
			connection.release()
		})
	})
})

router.get('/getUserStaffInfo', (req, res, next) => {
	const targetUid = req.query.uid
	const uid = req.user.uid
	if (!targetUid) {
		Util.sendResult(res, 1003, '参数缺失')
		return
	}
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
		}
		let userInfo = undefined
		let job_id = undefined
		let dep_id = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询用户是否存在
                connection.query(`SELECT * FROM lxm_user_staff WHERE uid= '${targetUid}'`, (err, rows) => {
                    if (rows && rows.length) {
						userInfo = rows[0]
						job_id = rows[0].job_id
						dep_id = rows[0].dep_id
                    } else {
                        Util.sendResult(res, 1000, '用户不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
			},
			function(callback) {
				// 查询用户岗位信息
				connection.query(`SELECT * FROM lxm_user_job WHERE job_id = ${job_id}`, (err, rows) => {
					if (rows && rows.length) {
						userInfo.jobInfo = rows[0]
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询用户部门信息
				connection.query(`SELECT * FROM lxm_user_department WHERE dep_id = ${dep_id}`, (err, rows) => {
					if (rows && rows.length) {
						userInfo.depInfo = rows[0]
					}
					callback(err)
				})
			}
		]
		async.waterfall(tasks, function(err, path, dep_dir) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '查询失败')
				});
			} else {
				connection.query('COMMIT', () => {
					delete userInfo.password
					Util.sendResult(res, 0, '查询成功', userInfo)
				});
			}
            connection.release()
		});
	});
})

router.get('/getMyInfo', (req, res, next) => {
	const uid = req.user.uid
    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
		}
		let userInfo = undefined
		let job_id = undefined
		let dep_id = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
            },
            function(callback) {
                // 查询用户是否存在
                connection.query(`SELECT * FROM lxm_user_staff WHERE uid= '${uid}'`, (err, rows) => {
                    if (rows && rows.length) {
						userInfo = rows[0]
						job_id = rows[0].job_id
						dep_id = rows[0].dep_id
                    } else {
                        Util.sendResult(res, 1000, '用户不存在')
                        connection.release()
                        return
                    }
                    callback(err)
                })
			},
			function(callback) {
				// 查询用户岗位信息
				connection.query(`SELECT * FROM lxm_user_job WHERE job_id = ${job_id}`, (err, rows) => {
					if (rows && rows.length) {
						userInfo.jobInfo = rows[0]
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询用户部门信息
				connection.query(`SELECT * FROM lxm_user_department WHERE dep_id = ${dep_id}`, (err, rows) => {
					if (rows && rows.length) {
						userInfo.depInfo = rows[0]
					}
					callback(err)
				})
			}
		]
		async.waterfall(tasks, function(err, path, dep_dir) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '查询失败')
				});
			} else {
				connection.query('COMMIT', () => {
					delete userInfo.password
					Util.sendResult(res, 0, '查询成功', userInfo)
				});
			}
            connection.release()
		});
	});
})

router.get('/canSetDep', (req, res, next) => {
	const uid = req.user.uid
	conn.getConnection((error, connection) => {
		if (error) return
		connection.query(userQuery.selectUserStaffWithUserId(uid), (err, rows) => {
			if (rows && rows.length) {
				const job_id = rows[0].job_id
				if (job_id === 0) {
					Util.sendResult(res, 0, '查询成功', 1)
				} else {
					connection.query(jobQuery.selectJobWithId(job_id), (err2, rows2) => {
						if (rows2 && rows2.length) {
							Util.sendResult(res, 0, '查询成功', rows2[0].dep_set)
						}
					})
				}
			}
			connection.release()
		})
	})
})

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
					// res.cookie('token', token)
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
							// res.cookie(token, genToken)
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
	Util.sendResult(res, 0, '退出成功')
})

router.post('/modifyPwd', (req, res, next) => {
	const uid = req.user.uid
	const {
		oldPassword,
		newPassword,
		newPassword2
	} = req.body

	if (!oldPassword || !newPassword || !newPassword2) {
		Util.sendResult(res, 1003, '参数缺失')
		return
	}
	if (newPassword !== newPassword2) {
		Util.sendResult(res, 1000, '两次密码不一样')
		return
	}

    conn.getConnection(function(error, connection) {
		if (error) {
			// log error, whatever
			return;
		}
		let oldPwd = undefined
        
		// 创建事务列表
		const tasks = [
			// begin transaction
			function(callback) {
				connection.query('BEGIN', err => {
					callback(err)
				});
			},
			function(callback) {
				// 查询当前用户是否存在
				connection.query(`SELECT * FROM lxm_user_staff WHERE uid='${uid}'`, (err, rows) => {
					if (rows && rows.length) {
						oldPwd = rows[0].password
						if (!Util.comparePassword(oldPassword, oldPwd)) {
							Util.sendResult(res, 1000, '旧密码不正确')
							connection.release()
							return
						}
					} else {
						Util.sendResult(res, 1000, '当前用户不存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 修改用户密码
				const genPwd = Util.genPassword(newPassword)
				connection.query(`UPDATE lxm_user_staff SET password='${genPwd}' WHERE uid='${uid}'`, err => {
					callback(err)
				})
			}
		]
		async.waterfall(tasks, function(err, path, dep_dir) {
			if (err) {
				console.error(err)
				connection.query('ROLLBACK', () => {
					Util.sendResult(res, 1000, '修改失败')
				});
			} else {
				connection.query('COMMIT', () => {
					Util.sendResult(res, 0, '修改成功')
				});
			}
            connection.release()
		});
	});
})

router.post('/deleteUser', (req, res, next) => {
    const uid = req.user.uid
	const targetUid = req.body.uid
	
    if (!targetUid) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }

    conn.getConnection((error, connection) => {
		if (error) return;
		let homefolder = undefined

        const tasks = [
            function(callback) {
                connection.query('BEGIN', err => {
                    callback(err)
                })
			},
			function(callback) {
				// 查找用户是否存在
				connection.query(`SELECT * FROM lxm_user_staff WHERE uid='${targetUid}' AND is_delete=0`, (err, rows) => {
					if (rows && rows.length) {
						homefolder = rows[0].homefolder
					} else {
						Util.sendResult(res, 1000, '用户不存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
            function(callback) {
                // 查询用户目录下是否还有文件
                connection.query(`SELECT * FROM lxm_file_file WHERE file_path like '${homefolder}%' AND is_delete=0`, (err, rows) => {
                    if (rows && rows.length) {
                        Util.sendResult(res, 1000, '用户目录下还有文件')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 查询用户目录下是否还有目录
                connection.query(`SELECT * FROM lxm_file_dir WHERE dir_path REGEXP '${homefolder}.+' AND is_delete=0`, (err, rows) => {
                    if (rows && rows.length) {
                        Util.sendResult(res, 1000, '用户目录下还有目录')
                        connection.release()
                        return
                    }
                    callback(err)
                })
            },
            function(callback) {
                // 删除目录表下的用户目录数据
                connection.query(`UPDATE lxm_file_dir SET is_delete=1, delete_uid='${uid}', delete_time=NOW() WHERE dir_path='${homefolder}' AND is_delete=0`, err => {
                    callback(err)
                })
            },
            function(callback) {
                // 删除用户表中的用户数据
                connection.query(`UPDATE lxm_user_staff SET is_delete=1, delete_uid='${uid}', delete_time=NOW() WHERE uid='${targetUid}' AND is_delete=0`, err => {
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

router.post('/modifyStaffInfo', (req, res, next) => {
	const uid = req.user.uid
	const {
		password,
		dep_id,
		job_id,
		phone_number,
		true_name,
		nick_name,
		ID_card
	} = req.body
	targetUid = req.body.uid
    if (!targetUid || !dep_id || !job_id || !phone_number || !true_name || !ID_card) {
        Util.sendResult(res, 1003, '参数缺失')
        return
    }

    conn.getConnection((error, connection) => {
		if (error) return;
		let modifyJobFlag = false
		
		let old_dep_id = undefined
		let old_job_id = undefined
		let old_username = undefined
		let time_name = undefined
		let old_show_path = undefined
		let old_homefolder = undefined
		let new_homefolder = undefined

        const tasks = [
            function(callback) {
                connection.query('BEGIN', err => {
                    callback(err)
                })
			},
			function(callback) {
				// 查询用户是否存在
				connection.query(`SELECT * FROM lxm_user_staff WHERE  uid='${targetUid}'`, (err, rows) => {
					if (rows && rows.length) {
						old_dep_id = rows[0].dep_id
						old_job_id = rows[0].job_id
						old_username = rows[0].username
						old_homefolder = rows[0].homefolder
						let homefolderArr = old_homefolder.split('/')
						time_name = homefolderArr[homefolderArr.length - 1]
						old_show_path = rows[0].show_path
					} else {
						Util.sendResult(res, 1000, '用户不存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询电话号码是否重复
				connection.query(`SELECT * FROM lxm_user_staff WHERE phone_number='${phone_number}' AND uid!='${targetUid}'`, (err, rows) => {
					if (rows && rows.length) {
						Util.sendResult(res, 1000, '手机号码已存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 查询身份证号码是否重复
				connection.query(`SELECT * FROM lxm_user_staff WHERE ID_card='${ID_card}' AND uid!='${targetUid}'`, (err, rows) => {
					if (rows && rows.length) {
						Util.sendResult(res, 1000, '身份证号码已存在')
						connection.release()
						return
					}
					callback(err)
				})
			},
			function(callback) {
				// 修改用户表的用户数据
				if (password && password.length) {
					connection.query(`UPDATE lxm_user_staff SET
						password='${Util.genPassword(password)}',
						phone_number='${phone_number}',
						true_name='${true_name}',
						nick_name='${nick_name}',
						ID_card='${ID_card}',
						update_uid='${uid}',
						update_time=NOW()
					WHERE uid='${targetUid}'`, err => {
						callback(err)
					})
				} else {
					connection.query(`UPDATE lxm_user_staff SET
						phone_number='${phone_number}',
						true_name='${true_name}',
						nick_name='${nick_name}',
						ID_card='${ID_card}',
						update_uid='${uid}',
						update_time=NOW()
					WHERE uid='${targetUid}'`, err => {
						callback(err)
					})
				}
			},
			function(callback) {
				/**
				 * 如果部门/岗位ID和旧的部门/岗位ID不一样，表示要进行部门和岗位的修改
				 * 否则表示不需要修改
				 */
				if (old_dep_id !== dep_id || old_job_id !== job_id) {
					modifyJobFlag = true
					let job_dir = undefined
					let job_dir_id = undefined
					let job_name = undefined
					let true_path = undefined

					const childTasks = [
						function(cb) {
							// 查询岗位是否在部门下
							connection.query(`SELECT * FROM lxm_user_job WHERE dep_id=${dep_id} AND job_id=${job_id} AND is_delete=0`, (err, rows) => {
								if (rows && rows.length) {
									job_dir = rows[0].job_dir
								} else {
									Util.sendResult(res, 1000, '部门岗位不匹配')
									connection.release()
									return
								}
								cb(err)
							})
						},
						function(cb) {
							// 根据岗位目录查询岗位的目录名称
							connection.query(`SELECT * FROM lxm_file_dir WHERE dir_path='${job_dir}' AND is_delete=0`, (err, rows) => {
								if (rows && rows.length) {
									job_name = rows[0].dir_name
									job_dir_id = rows[0].dir_id
									show_path = `${job_name}/${old_username}`
									let dir_pathArr = rows[0].dir_path.split(',')
									new_homefolder = `${rows[0].dir_path}/${time_name}`
								}
								cb(err)
							})
						},
						function(cb) {
							// 修改用户对应的用户目录
							connection.query(`UPDATE lxm_user_staff SET show_path='${show_path}', homefolder='${new_homefolder}', update_time=NOW() WHERE uid='${targetUid}'`, err => {
								cb(err)
							})
						},
						function(cb) {
							// 修改用户对应的部门/岗位ID
							connection.query(`UPDATE lxm_user_staff SET dep_id=${dep_id}, job_id=${job_id} WHERE uid='${targetUid}' AND is_delete=0`, err => {
								cb(err)
							})
						},
						function(cb) {
							// 修改目录表中用户目录的上级目录id
							connection.query(`UPDATE lxm_file_dir SET dir_pid=${job_dir_id} WHERE dir_path='${old_homefolder}' AND is_delete=0`, err => {
								cb(err)
							})
						},
						function(cb) {
							// 修改目录表中所有的目录名称
							connection.query(`UPDATE lxm_file_dir SET dir_name=REPLACE(dir_name, '${old_show_path}', '${show_path}')`, err => {
								cb(err)
							})
						},
						function(cb) {
							// 修改目录表中所有目录路径
							connection.query(`UPDATE lxm_file_dir SET dir_path=REPLACE(dir_path, '${old_homefolder}', '${new_homefolder}')`, err => {
								cb(err)
							})
						},
						function(cb) {
							// 修改文件表中的所有文件路径
							connection.query(`UPDATE lxm_file_file SET file_path=REPLACE(file_path, '${old_homefolder}', '${new_homefolder}')`, err => {
								cb(err)
							})
						}
					]

					async.waterfall(childTasks, err => {
						callback(err)
					})
				} else {
					callback(null)
				}
			}
			// function(callback) {
			// 	// 若修改用户名，则要修改用户名对应的目录和文件路径
			// }
        ]
        async.waterfall(tasks, err => {
            if (err) {
                console.error(err)
                connection.query('ROLLBACK', () => {
                    Util.sendResult(res, 1000, '修改失败')
                })
            } else {
                connection.query('COMMIT', () => {
					if (modifyJobFlag) {
						fs.renameSync(old_homefolder, new_homefolder)
					}
                    Util.sendResult(res, 0, '修改成功')
                })
            }
            connection.release()
        })
    })
})

module.exports = router;
