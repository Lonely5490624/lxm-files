const query = require('./query')
const uuidv1 = require('uuid/v1')

const cwd = process.cwd()

function selectUserCommonWithUsername(username) {
    const sql = `SELECT * FROM lxm_user_common WHERE username = '${username}' AND is_delete = 0`
    return sql
}

function selectUserStaffWithUserId(uid) {
    const sql= `SELECT * FROM lxm_user_staff WHERE uid = '${uid}' AND is_delete = 0`
    return sql
}

function selectUserStaffWithUsername(username) {
    const sql = `SELECT * FROM lxm_user_staff WHERE username = '${username}' AND is_delete = 0`
    return sql
}

function selectUserStaffWithJobId(job_id) {
    const sql =`SELECT * FROM lxm_user_staff WHERE job_id = ${job_id} AND is_delete= 0`
    return sql
}

function addUserCommon (values) {
    const sql = `INSERT INTO lxm_user_common (
        uid,
        username,
        password,
        phone,
        homefolder,
        create_time
    ) VALUES (
        '${values.uid}',
        '${values.username}',
        '${values.password}',
        '${values.phone}',
        '${values.homefolder}',
        NOW()
    )`
    return sql
}

function addUserStaff (values) {
    const sql = `INSERT INTO lxm_user_staff (
        uid,
        username,
        password,
        show_path,
        homefolder,
        dep_id,
        job_id,
        phone_number,
        true_name,
        nick_name,
        ID_card,
        create_uid,
        create_time
    ) VALUES (
        '${values.uid}',
        '${values.username}',
        '${values.password}',
        '${values.show_path}',
        '${values.homefolder}',
        '${values.dep_id}',
        '${values.job_id}',
        '${values.phone_number}',
        '${values.true_name}',
        '${values.nick_name}',
        '${values.ID_card}',
        '${values.create_uid}',
        NOW()
    )`
    return sql
}

function updateStaffLoginTimeWithUid (uid) {
    const sql = `UPDATE lxm_user_staff SET last_login_time = NOW() WHERE uid = '${uid}'`
    return sql
}

module.exports = {
    selectUserCommonWithUsername,
    selectUserStaffWithUserId,
    selectUserStaffWithUsername,
    selectUserStaffWithJobId,
    addUserCommon,
    addUserStaff,
    updateStaffLoginTimeWithUid
}