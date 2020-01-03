var jwt = require('jsonwebtoken')

var Util = require('../controller/util')

module.exports = function (req, res, next) {
    console.log(11111, req.path)
    if (req.method === 'OPTIONS' || req.path === '/api/users/login' || req.path === '/api/users/superReg' || req.path === '/api/users/regUserCommon' || req.path === '/api/users/findCommonPwd' || req.path === '/api/users/commonLogin' || req.path === '/api/users/getPhoneCode' || req.path === '/api/files/getFileDetail') {
        // 登录不需要token验证
        next()
        return
    }
    // const token = req.cookies.token
    let token = undefined
    if (req.method === 'GET') {
        token = req.query.token
    } else if (req.method === 'POST') {
        token = req.body.token
    }
    console.log(1111, req.method);
    if (!token) {
        Util.sendResult(res, 1001, 'token不存在')
        return
    } else {
        jwt.verify(token, 'lexuemao_2019_jwt', (err, decoded) => {
            if (err) {
                if (err.message === 'invalid signature') {
                    res.clearCookie('token')
                    Util.sendResult(res, 1001, 'token验证失败，请重新登录')
                    return
                } else if (err.message === 'jwt expired') {
                    res.clearCookie('token')
                    Util.sendResult(res, 1001, 'token过期，请重新登录')
                    return
                } else {
                    Util.sendResult(res, 1000, '错误', err)
                }
            } else {
              // 将携带的信息赋给req.user
                req.user = decoded
                return next()
            }
        })
    }
}