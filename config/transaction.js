let mysql = require('mysql')
let pool = require('./connection')

let trans = (tran) => {
    return new Promise((resolve, reject) => {  //返回promise提供事务成功与失败的接口
        pool.getConnection((err, conn) => {
            if(err) {
                reject(err)
            }else {
                conn.beginTransaction((err) => { //开始事务处理
                    if(err) {
                        conn.release()
                        reject(err)
                    }else {
                        let promise = tran(conn)  //调用事务处理函数
                        promise.then(result => {
                            conn.commit(err => {  //事务处理函数resolve则提交事务
                                if(err) {
                                    reject(err)
                                }else {
                                    resolve(result)
                                }
                            })
                        }).catch(err => {
                            conn.rollback(() => {  //事务处理函数reject则回滚事务
                                conn.release()
                                reject(err)
                            })
                        })
                    }
                })
            }
        })
    })
}

trans.query = (conn, sql, params) => {
    return new Promise((resolve, reject) => {
		console.log(4444, sql)
        conn.query(sql, params,(err, result) => {
            console.log(3333, err, result)
            if(err) {
                reject(err)
            }else {
                resolve(result)
            }
        })
    })
}

module.exports = trans