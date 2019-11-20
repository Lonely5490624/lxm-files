var jwt = require('jsonwebtoken')

var Util = require('../controller/util')

module.exports = function (req, res, next) {
    if (req.path === '/api/users/login' || req.path === '/api/users/superReg' || req.path === '/api/users/regUserCommon') {
        // 登录不需要token验证
        next()
        return
    }
    const token = req.cookies.token
    if (!token) {
        Util.sendResult(res, 1003, 'token不存在')
    } else {
        jwt.verify(token, 'lexuemao_2019_jwt', (err, decoded) => {
            if (err) {
                if (err.message === 'invalid signature') {
                    Util.sendResult(res, 1003, 'token验证失败，请重新登录')
                } else if (err.message === 'jwt expired') {
                    Util.sendResult(res, 1003, 'token过期，请重新登录')
                }
            } else {
              // 将携带的信息赋给req.user
                req.user = decoded
                return next()
            }
        })
    }
}