const fs = require('fs')
const uuidv1 = require('uuid/v1')
const dirQuery = require('../config/queries/dir')
const bcrypt = require('bcrypt')
var expressJWT = require('express-jwt')
var jwt = require('jsonwebtoken')

module.exports = {
    createStaffDir: async function (path) {
        if (!fs.existsSync(path)) fs.mkdirSync(path)
    },
    /**
     * @description 包装一个统一接口返回格式的方法
     * @param {Number} code 
     * @param {String} message 
     * @param {Object} data 
     */
    sendResult: function (res, code, message = 'success', data = null) {
        res.send({
            code,
            message,
            data
        })
    },
    getDirOrFileName (path) {
        let pathArr = path.split('/')
        return pathArr[pathArr.length - 1]
    },
    genPassword (pwd) {
        const salt = bcrypt.genSaltSync()
        return bcrypt.hashSync(pwd, salt)
    },
    comparePassword (pwd, pwdGened) {
        return bcrypt.compareSync(pwd, pwdGened)
    },
    genToken (info) {
        const obj = {
            MD5_SUFFIX: 'lexuemao',
            md5: function (pwd) {
                const md5 = crypto.createHash('md5');
                return md5.update(pwd).digest('hex');
            },
            secretKey: 'lexuemao_2019_jwt'
        }
        
        const token = jwt.sign(info, obj.secretKey, {
            expiresIn: 60 * 30
        })
        return token
    },
    getFileExt(filename) {
        return filename.substring(filename.lastIndexOf('.') + 1)
    },
    /**
     * 对数组中的对象某一字段重复的去重
     * @param {Array} arr 需要去重的数组（必须是以对象为元素的数组）
     * @param {String or Number} key 需要被检测的字段
     */
    reduceJsonArray(arr, key) {
        let new_arr = []
        arr.forEach(item => {
            if (!new_arr.length) {
                new_arr.push(item)
                return
            }
            let flag = true
            new_arr.forEach(element => {
                if (item[key] === element[key]) {
                    flag = false
                    return
                }
            });
            if(flag) new_arr.push(item)
        });
        return new_arr
    },
    /**
     * 将一维数组转成树形结构
     * @param {Array} list 需要转换的一维数组
     * @param {String} id 树形结构中有关联的id健
     * @param {String} pid 树形结构中有关联的pid健
     */
    listToTree(list, id, pid) {
        var map = {}, node, tree= [], i;
        for (i = 0; i < list.length; i ++) {
            list[i].children = []; 
            map[list[i][id]] = list[i]; 
        }
        for (i = 0; i < list.length; i += 1) {
            node = list[i];
            if (map[node[pid]]) {
                map[node[pid]].children.push(node);
            } else {
                tree.push(node);
            }
        }
        return tree;
    }
}